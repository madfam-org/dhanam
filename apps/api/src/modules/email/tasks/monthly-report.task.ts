import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

import { PrismaService } from '@core/prisma/prisma.service';
import { Currency } from '@db';
import { AnalyticsService } from '@modules/analytics/analytics.service';
import { ReportService } from '@modules/analytics/report.service';

import { EmailService } from '../email.service';

@Injectable()
export class MonthlyReportTask {
  private readonly logger = new Logger(MonthlyReportTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
    private readonly reportService: ReportService
  ) {}

  // Run on the 1st of each month at 10 AM
  @Cron('0 10 1 * *')
  async sendMonthlyReports() {
    this.logger.log('Starting monthly report email task');

    try {
      // Get all active users with monthly reports enabled
      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          preferences: {
            monthlyReports: true,
          },
        },
        include: {
          userSpaces: {
            where: {
              role: 'owner',
            },
            include: {
              space: true,
            },
          },
          preferences: true,
        },
      });

      const lastMonth = subMonths(new Date(), 1);
      const monthStart = startOfMonth(lastMonth);
      const monthEnd = endOfMonth(lastMonth);

      for (const user of users) {
        try {
          for (const userSpace of user.userSpaces) {
            const reportData = await this.generateMonthlyReport(
              userSpace.space.id,
              userSpace.userId,
              monthStart,
              monthEnd,
              userSpace.space.currency
            );

            if (reportData.hasActivity) {
              // Generate PDF report
              const pdfBuffer = await this.reportService.generatePdfReport(
                userSpace.space.id,
                monthStart,
                monthEnd
              );

              await this.emailService.sendMonthlyReportEmail(
                user.email,
                user.name,
                reportData,
                pdfBuffer
              );

              this.logger.log(`Sent monthly report to ${user.email}`);
            }
          }
        } catch (error) {
          this.logger.error(`Failed to send report to ${user.email}:`, error);
        }
      }

      this.logger.log('Monthly report email task completed');
    } catch (error) {
      this.logger.error('Monthly report task failed:', error);
    }
  }

  private async generateMonthlyReport(
    spaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    currency: Currency
  ) {
    // Get income and expenses
    const incomeVsExpenses = await this.analyticsService.getIncomeVsExpenses(userId, spaceId, 1);

    // Get the latest month data
    const latestMonth = incomeVsExpenses[0];
    const totalIncome = latestMonth?.income || 0;
    const totalExpenses = Math.abs(latestMonth?.expenses || 0);
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Get budget performance
    const budgets = await this.prisma.budget.findMany({
      where: {
        spaceId,
      },
      include: {
        categories: true,
      },
    });

    const budgetPerformance = await Promise.all(
      budgets.map(async (budget) => {
        // Get transactions for this budget's categories
        const budgetTransactions = await this.prisma.transaction.findMany({
          where: {
            categoryId: { in: budget.categories.map((c) => c.id) },
            date: { gte: startDate, lte: endDate },
          },
          include: { category: true },
        });

        const categories = budget.categories.map((category) => {
          const categoryTransactions = budgetTransactions.filter(
            (t) => t.categoryId === category.id
          );
          const actualSpent = categoryTransactions
            .filter((t) => t.amount.lt(0))
            .reduce((sum, t) => sum + Math.abs(t.amount.toNumber()), 0);

          return {
            category: category.name,
            budgeted: category.budgetedAmount.toNumber(),
            actual: actualSpent,
            variance: category.budgetedAmount.toNumber() - actualSpent,
          };
        });

        const totalBudgeted = categories.reduce((sum, c) => sum + c.budgeted, 0);
        const totalSpent = categories.reduce((sum, c) => sum + c.actual, 0);

        return {
          budgetName: budget.name,
          categories,
          totalBudgeted,
          totalSpent,
          totalVariance: totalBudgeted - totalSpent,
        };
      })
    );

    // Get net worth trend
    const netWorthData = await this.getNetWorthTrend(spaceId, startDate, endDate);

    // Get ESG data for crypto holdings
    const esgData = await this.getEsgData(spaceId);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      savingsRate,
      budgetPerformance,
      netWorthData
    );

    return {
      hasActivity: totalIncome > 0 || totalExpenses > 0,
      month: format(startDate, 'MMMM'),
      monthNumber: format(startDate, 'MM'),
      year: format(startDate, 'yyyy'),
      currency,
      totalIncome: totalIncome.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netSavings: netSavings.toFixed(2),
      savingsRate: savingsRate.toFixed(1),
      budgetPerformance: budgetPerformance.flat(),
      netWorthTrend: netWorthData.trend,
      currentNetWorth: netWorthData.current.toFixed(2),
      netWorthChange: netWorthData.change.toFixed(2),
      netWorthChangePercent: netWorthData.changePercent.toFixed(1),
      esgData,
      recommendations,
      hasAttachment: true,
    };
  }

  private async getNetWorthTrend(spaceId: string, startDate: Date, endDate: Date) {
    const startValuation = await this.prisma.assetValuation.findFirst({
      where: {
        account: {
          spaceId,
        },
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    const endValuation = await this.prisma.assetValuation.findFirst({
      where: {
        account: {
          spaceId,
        },
        date: {
          lte: endDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    const startValue = startValuation?.value.toNumber() || 0;
    const endValue = endValuation?.value.toNumber() || 0;
    const change = endValue - startValue;
    const changePercent = startValue > 0 ? (change / startValue) * 100 : 0;

    return {
      trend: change >= 0 ? 'increased' : 'decreased',
      current: endValue,
      change,
      changePercent,
    };
  }

  private async getEsgData(spaceId: string) {
    const cryptoAccounts = await this.prisma.account.findMany({
      where: {
        spaceId,
        provider: 'bitso',
        type: 'crypto',
      },
      include: {
        esgScores: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (cryptoAccounts.length === 0) {
      return null;
    }

    const avgScore =
      cryptoAccounts.reduce((sum, acc) => {
        const score = acc.esgScores[0]?.compositeScore || 0;
        return sum + Number(score);
      }, 0) / cryptoAccounts.length;

    let insight: string;
    if (avgScore >= 80) {
      insight = 'Your crypto portfolio has an excellent ESG score!';
    } else if (avgScore >= 60) {
      insight = 'Your crypto portfolio has a good ESG score with room for improvement.';
    } else {
      insight = 'Consider diversifying into more environmentally friendly crypto assets.';
    }

    return {
      score: Math.round(avgScore),
      insight,
    };
  }

  private generateRecommendations(
    savingsRate: number,
    budgetPerformance: any[],
    netWorthData: any
  ): string[] {
    const recommendations: string[] = [];

    // Savings rate recommendation
    if (savingsRate < 10) {
      recommendations.push('Aim to save at least 10-20% of your income for financial security.');
    } else if (savingsRate >= 30) {
      recommendations.push('Excellent savings rate! Consider investing surplus funds for growth.');
    }

    // Budget performance
    const overBudgetCategories = budgetPerformance.filter((b) => b.variance < 0);
    if (overBudgetCategories.length > 0) {
      const topOverspend = overBudgetCategories.sort((a, b) => a.variance - b.variance)[0];
      recommendations.push(
        `Review spending in ${topOverspend.category} which exceeded budget by ${Math.abs(topOverspend.variance).toFixed(2)}.`
      );
    }

    // Net worth trend
    if (netWorthData.changePercent < -5) {
      recommendations.push(
        'Your net worth declined significantly. Review investment performance and spending habits.'
      );
    } else if (netWorthData.changePercent > 10) {
      recommendations.push(
        'Strong net worth growth! Ensure proper diversification across asset classes.'
      );
    }

    // General recommendations
    const underutilizedBudgets = budgetPerformance.filter((b) => b.variance > b.budgeted * 0.5);
    if (underutilizedBudgets.length > 0) {
      recommendations.push(
        'Some budget categories are significantly underutilized. Consider reallocating funds.'
      );
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }
}
