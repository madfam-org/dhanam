import { PrismaClient, Currency } from '../../../generated/prisma';
import { SeedContext } from '../helpers';

export async function createManualAssetRecords(prisma: PrismaClient, ctx: SeedContext) {
  // 1. MANUAL ASSETS
  console.log('\n🏠 Creating manual assets...');

  const [
    carlosCondo,
    carlosTesla,
    patriciaPE,
    patriciaArt,
    diegoLand,
    diegoBayc,
    diegoWearables,
    diegoDomain,
  ] = await Promise.all([
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.carlosPersonal.id,
        name: 'CDMX Condo - Condesa',
        type: 'real_estate',
        description: '2BR/2BA condo in Colonia Condesa, Mexico City',
        currentValue: 4200000,
        currency: Currency.MXN,
        acquisitionDate: new Date('2020-03-15'),
        acquisitionCost: 3500000,
        metadata: {
          address: 'Av. Amsterdam 245',
          city: 'CDMX',
          state: 'CDMX',
          sqft: 95,
          propertyType: 'condo',
          bedrooms: 2,
          bathrooms: 2,
          documents: [
            {
              key: 'property-deed-condo.pdf',
              name: 'Property Deed',
              type: 'application/pdf',
              size: 245000,
              uploadedAt: '2024-01-15',
            },
            {
              key: 'appraisal-2024.pdf',
              name: '2024 Appraisal',
              type: 'application/pdf',
              size: 180000,
              uploadedAt: '2024-06-01',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.carlosPersonal.id,
        name: '2022 Tesla Model 3',
        type: 'vehicle',
        description: 'Tesla Model 3 Long Range, Midnight Silver',
        currentValue: 620000,
        currency: Currency.MXN,
        acquisitionDate: new Date('2022-06-01'),
        acquisitionCost: 890000,
        metadata: {
          make: 'Tesla',
          model: 'Model 3',
          year: 2022,
          mileage: 35000,
          vin: '5YJ3E1EA1NF000001',
          documents: [
            {
              key: 'tesla-title.pdf',
              name: 'Vehicle Title',
              type: 'application/pdf',
              size: 120000,
              uploadedAt: '2022-06-15',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.enterpriseSpace.id,
        name: 'Sequoia Capital Fund XIV',
        type: 'private_equity',
        description: 'LP stake in Sequoia Capital Growth Fund XIV',
        currentValue: 50000,
        currency: Currency.USD,
        acquisitionDate: new Date('2021-09-01'),
        acquisitionCost: 50000,
        metadata: {
          companyName: 'Sequoia Capital',
          investmentDate: '2021-09-01',
          ownershipPercentage: 0.001,
          shares: 50,
          shareClass: 'LP',
          documents: [
            {
              key: 'sequoia-lpa.pdf',
              name: 'LP Agreement',
              type: 'application/pdf',
              size: 520000,
              uploadedAt: '2021-09-15',
            },
            {
              key: 'sequoia-k1-2023.pdf',
              name: '2023 K-1',
              type: 'application/pdf',
              size: 95000,
              uploadedAt: '2024-03-15',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.enterpriseSpace.id,
        name: 'Frida Kahlo Lithograph - Self Portrait',
        type: 'art',
        description: 'Authenticated Frida Kahlo lithograph, limited edition #23/100',
        currentValue: 180000,
        currency: Currency.MXN,
        acquisitionDate: new Date('2019-11-20'),
        acquisitionCost: 120000,
        metadata: {
          category: 'lithograph',
          year: 1944,
          condition: 'excellent',
          authenticity: 'verified',
          collectible: {
            category: 'art',
            provider: 'artsy',
            externalId: 'frida-kahlo-self-portrait-litho-23',
            valuationEnabled: true,
            lastProviderSync: new Date(Date.now() - 2 * 86400000).toISOString(),
          },
          documents: [
            {
              key: 'frida-certificate.pdf',
              name: 'Certificate of Authenticity',
              type: 'application/pdf',
              size: 310000,
              uploadedAt: '2019-12-01',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.diegoSpace.id,
        name: 'The Sandbox LAND 3x3',
        type: 'collectible',
        description: '3x3 LAND plot in The Sandbox metaverse',
        currentValue: 2400,
        currency: Currency.USD,
        acquisitionDate: new Date('2022-01-15'),
        acquisitionCost: 4200,
        metadata: {
          category: 'metaverse_land',
          platform: 'The Sandbox',
          coordinates: '(-12, 45)',
          size: '3x3',
          documents: [
            {
              key: 'sandbox-land-receipt.png',
              name: 'Blockchain Receipt',
              type: 'image/png',
              size: 65000,
              uploadedAt: '2022-01-15',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.diegoSpace.id,
        name: 'BAYC #7291',
        type: 'collectible',
        description: 'Bored Ape Yacht Club NFT #7291',
        currentValue: 18500,
        currency: Currency.USD,
        acquisitionDate: new Date('2021-08-10'),
        acquisitionCost: 32000,
        metadata: {
          category: 'nft',
          collection: 'Bored Ape Yacht Club',
          tokenId: 7291,
          blockchain: 'ethereum',
          documents: [
            {
              key: 'bayc-provenance.pdf',
              name: 'OpenSea Provenance',
              type: 'application/pdf',
              size: 72000,
              uploadedAt: '2021-08-10',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.diegoSpace.id,
        name: 'Decentraland Wearables Collection',
        type: 'collectible',
        description: 'Collection of rare Decentraland wearable NFTs',
        currentValue: 850,
        currency: Currency.USD,
        acquisitionDate: new Date('2022-05-20'),
        acquisitionCost: 1200,
        metadata: {
          category: 'nft_wearable',
          platform: 'Decentraland',
          items: 12,
          documents: [
            {
              key: 'dcl-wearables-inventory.pdf',
              name: 'Wearables Inventory',
              type: 'application/pdf',
              size: 48000,
              uploadedAt: '2022-05-20',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.diegoSpace.id,
        name: 'diegonavarro.eth',
        type: 'domain',
        description: 'Premium ENS domain name',
        currentValue: 3200,
        currency: Currency.USD,
        acquisitionDate: new Date('2021-12-01'),
        acquisitionCost: 800,
        metadata: {
          domain: 'diegonavarro.eth',
          registrar: 'ENS',
          expiryDate: '2026-12-01',
          documents: [
            {
              key: 'ens-registration.png',
              name: 'Registration Receipt',
              type: 'image/png',
              size: 35000,
              uploadedAt: '2021-12-01',
            },
          ],
        },
      },
    }),
  ]);

  // Additional manual assets for missing ManualAssetType coverage
  const [patriciaAngel, patriciaJewelry, carlosJewelry, diegoSandboxPortfolio] = await Promise.all([
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.enterpriseSpace.id,
        name: 'Fintech Startup Series A',
        type: 'angel_investment',
        description: 'Angel investment in LATAM fintech startup - Series A round',
        currentValue: 50000,
        currency: Currency.USD,
        acquisitionDate: new Date('2023-03-15'),
        acquisitionCost: 50000,
        metadata: {
          companyName: 'PayLatam',
          round: 'Series A',
          equity: '0.5%',
          sector: 'fintech',
          stage: 'growth',
          documents: [
            {
              key: 'paylatam-safe.pdf',
              name: 'SAFE Agreement',
              type: 'application/pdf',
              size: 280000,
              uploadedAt: '2023-03-15',
            },
            {
              key: 'paylatam-cap-table.pdf',
              name: 'Cap Table',
              type: 'application/pdf',
              size: 95000,
              uploadedAt: '2023-03-20',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.enterpriseSpace.id,
        name: 'Estate Jewelry Collection',
        type: 'jewelry',
        description: 'Inherited estate jewelry collection - appraised value',
        currentValue: 25000,
        currency: Currency.USD,
        acquisitionDate: new Date('2018-06-01'),
        acquisitionCost: 15000,
        metadata: {
          items: 8,
          lastAppraisal: '2024-11-15',
          appraiser: "Christie's México",
          insured: true,
          documents: [
            {
              key: 'jewelry-appraisal-2024.pdf',
              name: 'Appraisal Report',
              type: 'application/pdf',
              size: 420000,
              uploadedAt: '2024-11-15',
            },
            {
              key: 'jewelry-insurance.pdf',
              name: 'Insurance Certificate',
              type: 'application/pdf',
              size: 180000,
              uploadedAt: '2024-12-01',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.carlosPersonal.id,
        name: 'Watch Collection',
        type: 'jewelry',
        description: 'Luxury watch collection (Rolex Submariner, Omega Speedmaster, TAG Heuer)',
        currentValue: 15000,
        currency: Currency.USD,
        acquisitionDate: new Date('2019-12-25'),
        acquisitionCost: 12000,
        metadata: {
          items: 3,
          watches: ['Rolex Submariner', 'Omega Speedmaster', 'TAG Heuer Carrera'],
          insured: true,
          documents: [
            {
              key: 'watch-collection-appraisal.pdf',
              name: 'Collection Appraisal',
              type: 'application/pdf',
              size: 190000,
              uploadedAt: '2024-06-01',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.diegoSpace.id,
        name: 'Sandbox LAND Portfolio (Virtual RE)',
        type: 'other',
        description: 'Portfolio of Sandbox metaverse LAND parcels tracked as virtual real estate',
        currentValue: 7800,
        currency: Currency.USD,
        acquisitionDate: new Date('2022-01-15'),
        acquisitionCost: 12000,
        metadata: {
          category: 'virtual_real_estate',
          platform: 'The Sandbox',
          totalParcels: 5,
          totalSize: '7 plots',
          documents: [
            {
              key: 'sandbox-portfolio-summary.pdf',
              name: 'Portfolio Summary',
              type: 'application/pdf',
              size: 110000,
              uploadedAt: '2024-06-15',
            },
          ],
        },
      },
    }),
  ]);

  // Patricia's HNW assets
  const [patriciaPenthouse, patriciaLifeInsurance, patricia529, patriciaAnnuity] =
    await Promise.all([
      prisma.manualAsset.create({
        data: {
          spaceId: ctx.enterpriseSpace.id,
          name: 'Polanco Penthouse',
          type: 'real_estate',
          description: '3BR/3BA penthouse in Polanco, CDMX — Zillow-tracked',
          currentValue: 450000,
          currency: Currency.USD,
          acquisitionDate: new Date('2019-04-10'),
          acquisitionCost: 380000,
          metadata: {
            address: 'Av. Presidente Masaryk 320 PH',
            city: 'CDMX',
            state: 'CDMX',
            sqft: 220,
            propertyType: 'penthouse',
            bedrooms: 3,
            bathrooms: 3,
            zillowId: 'zpid-9876543',
            documents: [
              {
                key: 'penthouse-deed.pdf',
                name: 'Property Deed',
                type: 'application/pdf',
                size: 310000,
                uploadedAt: '2019-05-01',
              },
              {
                key: 'penthouse-appraisal-2024.pdf',
                name: '2024 Appraisal',
                type: 'application/pdf',
                size: 200000,
                uploadedAt: '2024-08-15',
              },
            ],
          },
        },
      }),
      prisma.manualAsset.create({
        data: {
          spaceId: ctx.enterpriseSpace.id,
          name: 'Term Life Insurance — MetLife',
          type: 'other',
          description: 'MetLife 20-year term life insurance policy — $500K face value',
          currentValue: 500000,
          currency: Currency.USD,
          acquisitionDate: new Date('2020-01-15'),
          acquisitionCost: 0,
          metadata: {
            provider: 'MetLife',
            policyType: 'term_life',
            termYears: 20,
            faceValue: 500000,
            annualPremium: 1200,
            beneficiary: 'Carlos Mendoza',
            documents: [
              {
                key: 'metlife-policy.pdf',
                name: 'Policy Document',
                type: 'application/pdf',
                size: 450000,
                uploadedAt: '2020-02-01',
              },
            ],
          },
        },
      }),
      prisma.manualAsset.create({
        data: {
          spaceId: ctx.enterpriseSpace.id,
          name: '529 Education Savings — Vanguard',
          type: 'other',
          description: 'Vanguard 529 College Savings Plan',
          currentValue: 85000,
          currency: Currency.USD,
          acquisitionDate: new Date('2018-09-01'),
          acquisitionCost: 60000,
          metadata: {
            provider: 'Vanguard',
            planType: '529',
            beneficiary: 'Sofia Ruiz',
            state: 'Nevada',
            portfolio: 'Age-Based Aggressive',
            documents: [
              {
                key: '529-beneficiary-form.pdf',
                name: 'Beneficiary Form',
                type: 'application/pdf',
                size: 120000,
                uploadedAt: '2018-09-15',
              },
            ],
          },
        },
      }),
      prisma.manualAsset.create({
        data: {
          spaceId: ctx.enterpriseSpace.id,
          name: 'TIAA Fixed Annuity',
          type: 'other',
          description: 'TIAA Traditional fixed annuity — guaranteed income',
          currentValue: 200000,
          currency: Currency.USD,
          acquisitionDate: new Date('2017-06-01'),
          acquisitionCost: 150000,
          metadata: {
            provider: 'TIAA',
            annuityType: 'fixed',
            guaranteedRate: 3.5,
            payoutStart: '2035-01-01',
            documents: [
              {
                key: 'tiaa-contract.pdf',
                name: 'Annuity Contract',
                type: 'application/pdf',
                size: 380000,
                uploadedAt: '2017-06-15',
              },
            ],
          },
        },
      }),
    ]);

  // Carlos alternative assets
  const [carlosBeetle, carlosWine, carlosRolex] = await Promise.all([
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.carlosPersonal.id,
        name: '1967 VW Beetle (Classic)',
        type: 'vehicle',
        description: 'Restored 1967 Volkswagen Beetle — classic/vintage collector car',
        currentValue: 280000,
        currency: Currency.MXN,
        acquisitionDate: new Date('2021-03-20'),
        acquisitionCost: 180000,
        metadata: {
          make: 'Volkswagen',
          model: 'Beetle',
          year: 1967,
          condition: 'restored',
          mileage: 42000,
          color: 'Lotus White',
          collectible: {
            category: 'car',
            provider: 'hagerty',
            externalId: 'vw-beetle-1967',
            valuationEnabled: true,
            lastProviderSync: new Date(Date.now() - 3 * 86400000).toISOString(),
          },
          documents: [
            {
              key: 'beetle-title.pdf',
              name: 'Vehicle Title',
              type: 'application/pdf',
              size: 98000,
              uploadedAt: '2021-04-01',
            },
            {
              key: 'beetle-restoration.pdf',
              name: 'Restoration Certificate',
              type: 'application/pdf',
              size: 220000,
              uploadedAt: '2021-03-20',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.carlosPersonal.id,
        name: 'Wine Collection',
        type: 'collectible',
        description: '24-bottle curated collection — Napa Valley & Rioja vintages',
        currentValue: 45000,
        currency: Currency.MXN,
        acquisitionDate: new Date('2020-08-15'),
        acquisitionCost: 32000,
        metadata: {
          bottles: 24,
          regions: ['Napa Valley', 'Rioja'],
          topBottles: ['Opus One 2018', 'Vega Sicilia Unico 2012'],
          insured: true,
          storageLocation: 'Climate-controlled cellar',
          collectible: {
            category: 'wine',
            provider: 'wine-searcher',
            externalId: 'collection-carlos-24',
            valuationEnabled: true,
            lastProviderSync: new Date(Date.now() - 5 * 86400000).toISOString(),
          },
          documents: [
            {
              key: 'wine-insurance.pdf',
              name: 'Insurance Certificate',
              type: 'application/pdf',
              size: 150000,
              uploadedAt: '2024-02-10',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.carlosPersonal.id,
        name: 'Rolex Submariner',
        type: 'jewelry',
        description: 'Rolex Submariner Date 126610LN — purchased new',
        currentValue: 8500,
        currency: Currency.USD,
        acquisitionDate: new Date('2022-04-10'),
        acquisitionCost: 9100,
        metadata: {
          brand: 'Rolex',
          model: 'Submariner Date',
          reference: '126610LN',
          serialPrefix: '3YK',
          purchasedFrom: 'AD México',
          boxAndPapers: true,
          collectible: {
            category: 'watch',
            provider: 'watchcharts',
            externalId: 'rolex-126610ln',
            valuationEnabled: true,
            lastProviderSync: new Date(Date.now() - 1 * 86400000).toISOString(),
          },
          documents: [
            {
              key: 'rolex-warranty.pdf',
              name: 'Warranty Card',
              type: 'application/pdf',
              size: 85000,
              uploadedAt: '2022-04-10',
            },
          ],
        },
      },
    }),
  ]);

  // Sneaker collectible assets (sneaks adapter is the only working adapter)
  const [mariaSneaker, carlosSneaker] = await Promise.all([
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.mariaSpace.id,
        name: 'Nike Air Force 1 Low White',
        type: 'collectible',
        description: 'Nike Air Force 1 Low White — DS, size 8W',
        currentValue: 120,
        currency: Currency.USD,
        acquisitionDate: new Date('2024-06-01'),
        acquisitionCost: 110,
        metadata: {
          collectible: {
            category: 'sneaker',
            provider: 'sneaks',
            externalId: 'CW2288-111',
            valuationEnabled: true,
            lastProviderSync: new Date().toISOString(),
          },
          documents: [
            {
              key: 'af1-receipt.pdf',
              name: 'Purchase Receipt',
              type: 'application/pdf',
              size: 32000,
              uploadedAt: '2024-06-01',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.carlosPersonal.id,
        name: 'Jordan 1 Retro High OG Chicago',
        type: 'collectible',
        description: 'Air Jordan 1 Retro High OG "Chicago" 2015 — size 10, VNDS',
        currentValue: 1850,
        currency: Currency.USD,
        acquisitionDate: new Date('2023-09-15'),
        acquisitionCost: 1200,
        metadata: {
          collectible: {
            category: 'sneaker',
            provider: 'sneaks',
            externalId: '555088-101',
            valuationEnabled: true,
            lastProviderSync: new Date().toISOString(),
          },
          documents: [
            {
              key: 'jordan-receipt.pdf',
              name: 'Purchase Receipt',
              type: 'application/pdf',
              size: 45000,
              uploadedAt: '2023-09-15',
            },
          ],
        },
      },
    }),
  ]);

  console.log('  ✓ Created 2 sneaker collectible assets (sneaks adapter)');

  // PCGS coin + PSA trading card collectibles
  const [carlosCoin, diegoCard] = await Promise.all([
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.carlosPersonal.id,
        name: '1893-S Morgan Silver Dollar',
        type: 'collectible',
        description: 'PCGS-graded MS-63 Morgan Silver Dollar — key date',
        currentValue: 42000,
        currency: Currency.USD,
        acquisitionDate: new Date('2022-11-10'),
        acquisitionCost: 35000,
        metadata: {
          collectible: {
            category: 'coin',
            provider: 'pcgs',
            externalId: 'cert-12345678',
            valuationEnabled: true,
            lastProviderSync: new Date(Date.now() - 4 * 86400000).toISOString(),
          },
          grade: 'MS-63',
          mintage: 100000,
          composition: '90% silver',
          documents: [
            {
              key: 'pcgs-cert-12345678.pdf',
              name: 'PCGS Certificate',
              type: 'application/pdf',
              size: 95000,
              uploadedAt: '2022-11-10',
            },
          ],
        },
      },
    }),
    prisma.manualAsset.create({
      data: {
        spaceId: ctx.diegoSpace.id,
        name: 'PSA 10 Charizard Base Set',
        type: 'collectible',
        description: 'PSA 10 Gem Mint 1st Edition Charizard — Pokémon Base Set',
        currentValue: 350000,
        currency: Currency.USD,
        acquisitionDate: new Date('2023-05-20'),
        acquisitionCost: 280000,
        metadata: {
          collectible: {
            category: 'card',
            provider: 'psa',
            externalId: 'cert-87654321',
            valuationEnabled: true,
            lastProviderSync: new Date(Date.now() - 2 * 86400000).toISOString(),
          },
          grade: 'PSA 10 Gem Mint',
          set: 'Base Set 1st Edition',
          cardNumber: '4/102',
          documents: [
            {
              key: 'psa-cert-87654321.pdf',
              name: 'PSA Certificate',
              type: 'application/pdf',
              size: 88000,
              uploadedAt: '2023-05-20',
            },
          ],
        },
      },
    }),
  ]);

  console.log('  ✓ Created 2 additional collectibles (PCGS coin + PSA card)');

  const allManualAssets = [
    carlosCondo,
    carlosTesla,
    patriciaPE,
    patriciaArt,
    diegoLand,
    diegoBayc,
    diegoWearables,
    diegoDomain,
    patriciaAngel,
    patriciaJewelry,
    carlosJewelry,
    diegoSandboxPortfolio,
    patriciaPenthouse,
    patriciaLifeInsurance,
    patricia529,
    patriciaAnnuity,
    carlosBeetle,
    carlosWine,
    carlosRolex,
    mariaSneaker,
    carlosSneaker,
    carlosCoin,
    diegoCard,
  ];

  return { patriciaPE, allManualAssets };
}
