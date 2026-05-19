import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
// import * as crypto from 'crypto'; - not used
import * as bitcoin from 'bitcoinjs-lib';
import * as ethers from 'ethers';

import { MonitorPerformance } from '@core/decorators/monitor-performance.decorator';
import { TIMEOUT_PRESETS } from '@core/utils/timeout.util';
import type { InputJsonValue } from '@db';
import { Prisma as _Prisma, Account, Currency, AccountType } from '@db';

import { AuditService } from '../../../core/audit/audit.service';
// import { CryptoService } from '../../../core/crypto/crypto.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BlockchainAccountMetadata } from '../../../types/metadata.types';
import { isUniqueConstraintError } from '../../../types/prisma-errors.types';

import { AddWalletDto, ImportWalletDto } from './dto';

interface BlockchainBalance {
  address: string;
  balance: string;
  currency: string;
  usdValue: number;
  lastBlock: number;
}

interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  fee: string;
  timestamp: number;
  blockNumber: number;
  status: 'confirmed' | 'pending' | 'failed';
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private ethProvider: ethers.JsonRpcProvider | null = null;
  private btcClient: AxiosInstance | null = null;
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 300000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    // private readonly cryptoService: CryptoService, - not used
    private readonly auditService: AuditService
  ) {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize Ethereum provider
    const ethRpcUrl = this.configService.get(
      'ETH_RPC_URL',
      'https://eth-mainnet.g.alchemy.com/v2/demo'
    );
    this.ethProvider = new ethers.JsonRpcProvider(ethRpcUrl);

    // Initialize Bitcoin API client
    this.btcClient = axios.create({
      baseURL: 'https://blockchain.info',
      timeout: TIMEOUT_PRESETS.blockchain_query,
    });

    this.logger.log('Blockchain providers initialized');
  }

  async addWallet(
    spaceId: string,
    userId: string,
    dto: AddWalletDto
  ): Promise<{ account: Account; message: string }> {
    try {
      // Validate address format
      this.validateAddress(dto.address, dto.currency);

      // Check if wallet already exists
      const existingAccount = await this.prisma.account.findFirst({
        where: {
          spaceId,
          provider: 'manual',
          providerAccountId: dto.address.toLowerCase(),
        },
      });

      if (existingAccount) {
        throw new BadRequestException('Wallet already added to this space');
      }

      // Fetch initial balance
      const balance = await this.getBalance(dto.address, dto.currency);

      // Get USD price
      const usdPrice = await this.getCryptoPrice(dto.currency);
      const usdValue = parseFloat(balance.balance) * usdPrice;

      // Create account
      const account = await this.prisma.account.create({
        data: {
          spaceId,
          provider: 'manual',
          providerAccountId: dto.address.toLowerCase(),
          name: dto.name || `${dto.currency.toUpperCase()} Wallet`,
          type: 'crypto' as AccountType,
          subtype: 'non-custodial',
          currency: Currency.USD,
          balance: Math.round(usdValue * 100) / 100,
          lastSyncedAt: new Date(),
          metadata: {
            address: dto.address,
            cryptoCurrency: dto.currency.toUpperCase(),
            cryptoBalance: balance.balance,
            label: dto.label,
            network: this.getNetwork(dto.currency),
            lastBlock: balance.lastBlock,
            readOnly: true,
            addedAt: new Date().toISOString(),
          } as InputJsonValue,
        },
      });

      // Audit log
      await this.auditService.logEvent({
        action: 'wallet_added',
        resource: 'account',
        resourceId: account.id,
        userId,
        metadata: {
          address: dto.address,
          currency: dto.currency,
          spaceId,
        },
      });

      // Fetch initial transaction history
      await this.syncWalletTransactions(account.id, dto.address, dto.currency);

      this.logger.log(`Added ${dto.currency} wallet ${dto.address} for user ${userId}`);
      return {
        account,
        message: `Successfully added ${dto.currency.toUpperCase()} wallet`,
      };
    } catch (error) {
      this.logger.error('Failed to add wallet:', error);
      throw error;
    }
  }

  async importWallet(
    spaceId: string,
    userId: string,
    dto: ImportWalletDto
  ): Promise<{ accounts: Account[]; message: string }> {
    try {
      // Validate xPub format
      this.validateXPub(dto.xpub, dto.currency);

      // Derive addresses from xPub
      const addresses = await this.deriveAddresses(dto.xpub, dto.currency, dto.derivationPath);

      const accounts: Account[] = [];

      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];

        // Skip if already exists
        const exists = await this.prisma.account.findFirst({
          where: {
            spaceId,
            provider: 'manual',
            providerAccountId: address!.toLowerCase(),
          },
        });

        if (exists) continue;

        // Fetch balance
        const balance = await this.getBalance(address!, dto.currency);

        // Skip empty addresses unless explicitly requested
        if (parseFloat(balance.balance) === 0 && !dto.includeEmpty) continue;

        // Get USD price
        const usdPrice = await this.getCryptoPrice(dto.currency);
        const usdValue = parseFloat(balance.balance) * usdPrice;

        // Create account
        const account = await this.prisma.account.create({
          data: {
            spaceId,
            provider: 'manual',
            providerAccountId: address!.toLowerCase(),
            name: `${dto.currency.toUpperCase()} ${dto.derivationPath}/${i}`,
            type: 'crypto' as AccountType,
            subtype: 'non-custodial',
            currency: Currency.USD,
            balance: Math.round(usdValue * 100) / 100,
            lastSyncedAt: new Date(),
            metadata: {
              address,
              cryptoCurrency: dto.currency.toUpperCase(),
              cryptoBalance: balance.balance,
              xpub: dto.xpub,
              derivationPath: `${dto.derivationPath}/${i}`,
              network: this.getNetwork(dto.currency),
              lastBlock: balance.lastBlock,
              readOnly: true,
              addedAt: new Date().toISOString(),
            } as InputJsonValue,
          },
        });

        accounts.push(account);
      }

      // Audit log
      await this.auditService.logEvent({
        action: 'xpub_imported',
        resource: 'account',
        resourceId: spaceId,
        userId,
        metadata: {
          currency: dto.currency,
          accountsCount: accounts.length,
          derivationPath: dto.derivationPath,
        },
      });

      this.logger.log(`Imported ${accounts.length} wallets from xPub for user ${userId}`);
      return {
        accounts,
        message: `Successfully imported ${accounts.length} ${dto.currency.toUpperCase()} wallets`,
      };
    } catch (error) {
      this.logger.error('Failed to import xPub:', error);
      throw error;
    }
  }

  private validateAddress(address: string, currency: string): void {
    switch (currency.toLowerCase()) {
      case 'eth':
        if (!ethers.isAddress(address)) {
          throw new BadRequestException('Invalid Ethereum address');
        }
        break;
      case 'btc':
        try {
          bitcoin.address.toOutputScript(address);
        } catch {
          throw new BadRequestException('Invalid Bitcoin address');
        }
        break;
      default:
        throw new BadRequestException(`Unsupported currency: ${currency}`);
    }
  }

  private validateXPub(xpub: string, currency: string): void {
    if (currency.toLowerCase() !== 'btc') {
      throw new BadRequestException('xPub import only supported for Bitcoin');
    }

    if (!xpub.startsWith('xpub') && !xpub.startsWith('ypub') && !xpub.startsWith('zpub')) {
      throw new BadRequestException('Invalid xPub format');
    }
  }

  private getNetwork(currency: string): string {
    switch (currency.toLowerCase()) {
      case 'eth':
        return 'ethereum';
      case 'btc':
        return 'bitcoin';
      default:
        return currency.toLowerCase();
    }
  }

  @MonitorPerformance(5000) // 5 second threshold
  private async getBalance(address: string, currency: string): Promise<BlockchainBalance> {
    try {
      switch (currency.toLowerCase()) {
        case 'eth':
          return await this.getEthBalance(address);
        case 'btc':
          return await this.getBtcBalance(address);
        default:
          throw new BadRequestException(`Unsupported currency: ${currency}`);
      }
    } catch (error) {
      this.logger.error(`Failed to get balance for ${address}:`, error);
      throw error;
    }
  }

  private async getEthBalance(address: string): Promise<BlockchainBalance> {
    const balance = await this.ethProvider!.getBalance(address);
    const blockNumber = await this.ethProvider!.getBlockNumber();

    return {
      address,
      balance: ethers.formatEther(balance),
      currency: 'ETH',
      usdValue: 0, // Will be calculated separately
      lastBlock: blockNumber,
    };
  }

  /**
   * Get ERC-20 token balance for an address
   * @param address - Ethereum address
   * @param tokenAddress - ERC-20 token contract address
   * @param tokenSymbol - Token symbol (e.g., 'USDT', 'USDC')
   * @param decimals - Token decimals (default: 18)
   */
  async getErc20Balance(
    address: string,
    tokenAddress: string,
    tokenSymbol: string,
    decimals: number = 18
  ): Promise<BlockchainBalance> {
    const erc20Abi = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];

    const contract = new ethers.Contract(tokenAddress, erc20Abi, this.ethProvider!);

    const balance = await contract.balanceOf(address);
    const tokenDecimals = decimals || (await contract.decimals());
    const formattedBalance = ethers.formatUnits(balance, tokenDecimals);
    const blockNumber = await this.ethProvider!.getBlockNumber();

    return {
      address,
      balance: formattedBalance,
      currency: tokenSymbol.toUpperCase(),
      usdValue: 0, // Will be calculated separately
      lastBlock: blockNumber,
    };
  }

  private static readonly BTC_ADDRESS_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;

  private validateBtcAddress(address: string): string {
    if (!BlockchainService.BTC_ADDRESS_RE.test(address)) {
      throw new Error('Invalid BTC address format');
    }
    return encodeURIComponent(address);
  }

  private async getBtcBalance(address: string): Promise<BlockchainBalance> {
    const response = await this.btcClient!.get(
      `/rawaddr/${this.validateBtcAddress(address)}?limit=0`
    );
    const data = response.data;

    const balanceBtc = data.final_balance / 100000000; // Convert from satoshis

    return {
      address,
      balance: balanceBtc.toString(),
      currency: 'BTC',
      usdValue: 0, // Will be calculated separately
      lastBlock: data.n_tx || 0,
    };
  }

  private async getCryptoPrice(currency: string): Promise<number> {
    const cacheKey = currency.toUpperCase();
    const cached = this.priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
      return cached.price;
    }

    try {
      // Use CoinGecko API for prices
      const coinId = this.getCoinGeckoId(currency);
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
      );

      const price = response.data[coinId].usd;
      this.priceCache.set(cacheKey, { price, timestamp: Date.now() });

      return price;
    } catch (error) {
      this.logger.error(`Failed to fetch price for ${currency}:`, error);
      // Return last known price or 0
      return cached?.price || 0;
    }
  }

  private getCoinGeckoId(currency: string): string {
    const mapping: Record<string, string> = {
      eth: 'ethereum',
      btc: 'bitcoin',
      // Add more mappings as needed
    };

    return mapping[currency.toLowerCase()] || currency.toLowerCase();
  }

  private async deriveAddresses(
    _xpub: string,
    currency: string,
    _basePath: string
  ): Promise<string[]> {
    if (currency.toLowerCase() !== 'btc') {
      throw new BadRequestException('Address derivation only supported for Bitcoin');
    }

    // Bitcoin HD wallet derivation - bip32 not available in newer versions
    // Would need to use @scure/bip32 or similar library
    throw new BadRequestException('xPub import temporarily disabled');
  }

  @MonitorPerformance(10000) // 10 second threshold
  private async syncWalletTransactions(
    accountId: string,
    address: string,
    currency: string
  ): Promise<void> {
    try {
      const transactions = await this.getTransactions(address, currency);

      for (const tx of transactions) {
        await this.createTransactionFromBlockchain(accountId, tx, address);
      }

      this.logger.log(`Synced ${transactions.length} transactions for ${address}`);
    } catch (error) {
      this.logger.error(`Failed to sync transactions for ${address}:`, error);
    }
  }

  private async getTransactions(
    address: string,
    currency: string
  ): Promise<BlockchainTransaction[]> {
    switch (currency.toLowerCase()) {
      case 'eth':
        return await this.getEthTransactions(address);
      case 'btc':
        return await this.getBtcTransactions(address);
      default:
        return [];
    }
  }

  private async getEthTransactions(address: string): Promise<BlockchainTransaction[]> {
    // Note: This is a simplified version. In production, you'd use Etherscan API or similar
    const transactions: BlockchainTransaction[] = [];

    try {
      // Get recent blocks
      const blockNumber = await this.ethProvider!.getBlockNumber();
      const blocksToCheck = 100; // Check last 100 blocks

      for (let i = blockNumber - blocksToCheck; i <= blockNumber; i++) {
        const block = await this.ethProvider!.getBlock(i, true);
        if (!block || !block.transactions) continue;

        for (const tx of block.transactions) {
          if (typeof tx === 'string') continue;

          // Type guard for transaction response
          const txResponse = tx as ethers.TransactionResponse;

          if (
            txResponse.from?.toLowerCase() === address.toLowerCase() ||
            txResponse.to?.toLowerCase() === address.toLowerCase()
          ) {
            transactions.push({
              hash: txResponse.hash,
              from: txResponse.from,
              to: txResponse.to || '',
              value: ethers.formatEther(txResponse.value),
              fee: ethers.formatEther(txResponse.gasPrice! * txResponse.gasLimit),
              timestamp: block.timestamp,
              blockNumber: block.number,
              status: 'confirmed',
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to fetch ETH transactions:', error);
    }

    return transactions;
  }

  private async getBtcTransactions(address: string): Promise<BlockchainTransaction[]> {
    try {
      const response = await this.btcClient!.get(
        `/rawaddr/${this.validateBtcAddress(address)}?limit=50`
      );
      const data = response.data;

      return data.txs.map((tx: any) => ({
        hash: tx.hash,
        from: tx.inputs[0]?.prev_out?.addr || 'unknown',
        to: tx.out[0]?.addr || 'unknown',
        value: (tx.result / 100000000).toString(),
        fee: (tx.fee / 100000000).toString(),
        timestamp: tx.time,
        blockNumber: tx.block_height || 0,
        status: tx.block_height ? 'confirmed' : 'pending',
      }));
    } catch (error) {
      this.logger.error('Failed to fetch BTC transactions:', error);
      return [];
    }
  }

  private async createTransactionFromBlockchain(
    accountId: string,
    tx: BlockchainTransaction,
    walletAddress: string
  ): Promise<void> {
    try {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account) return;

      const metadata = account.metadata as unknown as BlockchainAccountMetadata;
      const isIncoming = tx.to.toLowerCase() === walletAddress.toLowerCase();
      const amount = isIncoming ? parseFloat(tx.value) : -parseFloat(tx.value);

      // Convert to USD
      const cryptoPrice = await this.getCryptoPrice(metadata.cryptoCurrency.toLowerCase());
      const usdAmount = amount * cryptoPrice;

      await this.prisma.transaction.create({
        data: {
          accountId,
          providerTransactionId: tx.hash,
          amount: Math.round(usdAmount * 100) / 100,
          currency: Currency.USD,
          date: new Date(tx.timestamp * 1000),
          description: `${metadata.cryptoCurrency} ${isIncoming ? 'Received' : 'Sent'}`,
          merchant: 'Blockchain Transfer',
          metadata: {
            txHash: tx.hash,
            from: tx.from,
            to: tx.to,
            cryptoAmount: tx.value,
            cryptoCurrency: metadata.cryptoCurrency,
            fee: tx.fee,
            blockNumber: tx.blockNumber,
            status: tx.status,
            network: metadata.network,
          } as InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Transaction already exists
        return;
      }
      this.logger.error(`Failed to create transaction ${tx.hash}:`, error);
    }
  }

  async syncWallets(userId: string): Promise<void> {
    try {
      const accounts = await this.prisma.account.findMany({
        where: {
          provider: 'manual',
          space: {
            userSpaces: {
              some: { userId },
            },
          },
        },
      });

      for (const account of accounts) {
        const metadata = account.metadata as unknown as BlockchainAccountMetadata;

        // Update balance
        const balance = await this.getBalance(
          metadata.address,
          metadata.cryptoCurrency.toLowerCase()
        );
        const usdPrice = await this.getCryptoPrice(metadata.cryptoCurrency.toLowerCase());
        const usdValue = parseFloat(balance.balance) * usdPrice;

        const updatedAccount = await this.prisma.account.update({
          where: { id: account.id },
          data: {
            balance: Math.round(usdValue * 100) / 100,
            lastSyncedAt: new Date(),
            metadata: {
              ...metadata,
              cryptoBalance: balance.balance,
              lastBlock: balance.lastBlock,
              lastPriceUpdate: new Date().toISOString(),
            },
          },
        });

        // Create valuation snapshot for daily tracking
        await this.prisma.assetValuation.create({
          data: {
            accountId: updatedAccount.id,
            date: new Date(),
            value: updatedAccount.balance,
            currency: Currency.USD,
          },
        });

        // Sync recent transactions
        await this.syncWalletTransactions(
          account.id,
          metadata.address,
          metadata.cryptoCurrency.toLowerCase()
        );
      }

      this.logger.log(`Synced blockchain wallets for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to sync wallets for user ${userId}:`, error);
    }
  }

  async removeWallet(accountId: string, userId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        space: {
          include: {
            userSpaces: true,
          },
        },
      },
    });

    if (!account) {
      throw new BadRequestException('Wallet not found');
    }

    // Verify user has access
    const hasAccess = account.space.userSpaces.some((us) => us.userId === userId);
    if (!hasAccess) {
      throw new BadRequestException('Access denied');
    }

    // Soft delete by marking as inactive
    const currentMetadata = account.metadata as unknown as BlockchainAccountMetadata;
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        // Remove isActive as it doesn't exist on Account model
        metadata: {
          ...currentMetadata,
          deletedAt: new Date().toISOString(),
          deletedBy: userId,
        } as InputJsonValue,
      },
    });

    // Audit log
    const metadata = account.metadata as unknown as BlockchainAccountMetadata;
    await this.auditService.logEvent({
      action: 'wallet_removed',
      resource: 'account',
      resourceId: accountId,
      userId,
      metadata: {
        address: metadata.address,
        currency: metadata.cryptoCurrency,
      },
    });

    this.logger.log(`Removed wallet ${accountId} for user ${userId}`);
  }
}
