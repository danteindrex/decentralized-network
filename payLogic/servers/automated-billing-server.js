/**
 * Automated Billing System MCP Server
 * Handles subscription billing, usage-based charging, and payment collection
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from 'axios';
import cron from 'node-cron';
import config from '../configs/config.js';

const server = new McpServer({
  name: "automated-billing",
  version: "1.0.0"
});

// In-memory storage for billing data
const billingPlans = new Map();
const customerSubscriptions = new Map();
const usageTracking = new Map();
const invoices = new Map();
const billingJobs = new Map();

// Create billing plan
server.registerTool("create_billing_plan", {
  title: "Create Billing Plan",
  description: "Define pricing plans for IPFS storage, AI inference, or custom services",
  inputSchema: {
    planId: { type: "string", description: "Unique plan identifier" },
    name: { type: "string", description: "Plan name" },
    type: {
      type: "string",
      enum: ["subscription", "usage_based", "hybrid", "one_time"],
      description: "Billing plan type"
    },
    pricing: {
      type: "object",
      properties: {
        basePrice: { type: "number", description: "Base subscription price (USD)" },
        currency: { type: "string", description: "Pricing currency", default: "USD" },
        billingCycle: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
          description: "Billing frequency"
        },
        usageRates: {
          type: "object",
          properties: {
            storagePerGB: { type: "number", description: "Price per GB storage" },
            inferencePerQuery: { type: "number", description: "Price per AI query" },
            bandwidthPerGB: { type: "number", description: "Price per GB bandwidth" },
            computePerHour: { type: "number", description: "Price per compute hour" }
          }
        },
        tiers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "number", description: "Usage tier start" },
              to: { type: "number", description: "Usage tier end" },
              rate: { type: "number", description: "Rate for this tier" }
            }
          }
        }
      }
    },
    features: {
      type: "array",
      items: { type: "string" },
      description: "Included features"
    },
    limits: {
      type: "object",
      properties: {
        maxStorage: { type: "number", description: "Storage limit (GB)" },
        maxQueries: { type: "number", description: "Query limit per month" },
        maxUsers: { type: "number", description: "User limit" }
      }
    }
  }
}, async (planId, name, type, pricing, features = [], limits = {}) => {
  try {
    const plan = {
      id: planId,
      name,
      type,
      pricing: {
        basePrice: pricing.basePrice || 0,
        currency: pricing.currency || 'USD',
        billingCycle: pricing.billingCycle || 'monthly',
        usageRates: pricing.usageRates || {},
        tiers: pricing.tiers || []
      },
      features,
      limits: {
        maxStorage: limits.maxStorage || Infinity,
        maxQueries: limits.maxQueries || Infinity,
        maxUsers: limits.maxUsers || Infinity
      },
      createdAt: new Date().toISOString(),
      isActive: true,
      subscriberCount: 0
    };

    billingPlans.set(planId, plan);

    return {
      success: true,
      message: "Billing plan created successfully",
      plan: {
        id: planId,
        name,
        type,
        basePrice: plan.pricing.basePrice,
        currency: plan.pricing.currency,
        billingCycle: plan.pricing.billingCycle,
        features: features.length,
        status: "active"
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to create billing plan: ${error.message}`
    };
  }
});

// Subscribe customer to billing plan
server.registerTool("create_subscription", {
  title: "Create Customer Subscription",
  description: "Subscribe customer to a billing plan with automated payments",
  inputSchema: {
    subscriptionId: { type: "string", description: "Unique subscription identifier" },
    customerId: { type: "string", description: "Customer identifier" },
    customerEmail: { type: "string", description: "Customer email" },
    planId: { type: "string", description: "Billing plan to subscribe to" },
    paymentMethod: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["bitcoin_wallet", "lightning_wallet", "virtual_card", "bank_account"],
          description: "Payment method type"
        },
        details: {
          type: "object",
          properties: {
            address: { type: "string", description: "Bitcoin address or card ID" },
            autoReload: { type: "boolean", description: "Auto-reload from crypto" },
            backupMethod: { type: "string", description: "Backup payment method" }
          }
        }
      }
    },
    startDate: { type: "string", description: "Subscription start date (ISO)" },
    customPricing: {
      type: "object",
      properties: {
        discount: { type: "number", description: "Discount percentage" },
        customRate: { type: "number", description: "Custom rate override" }
      }
    }
  }
}, async (subscriptionId, customerId, customerEmail, planId, paymentMethod, startDate = null, customPricing = {}) => {
  try {
    const plan = billingPlans.get(planId);
    if (!plan) {
      return { success: false, error: "Billing plan not found" };
    }

    const subscription = {
      id: subscriptionId,
      customerId,
      customerEmail,
      planId,
      plan: plan.name,
      paymentMethod,
      pricing: {
        basePrice: plan.pricing.basePrice,
        currency: plan.pricing.currency,
        billingCycle: plan.pricing.billingCycle,
        discount: customPricing.discount || 0,
        customRate: customPricing.customRate,
        effectivePrice: calculateEffectivePrice(plan.pricing.basePrice, customPricing)
      },
      status: 'active',
      startDate: startDate || new Date().toISOString(),
      nextBillingDate: calculateNextBillingDate(plan.pricing.billingCycle, startDate),
      usage: {
        currentCycle: {
          storage: 0,
          queries: 0,
          bandwidth: 0,
          computeHours: 0
        },
        limits: plan.limits
      },
      billingHistory: [],
      totalBilled: 0,
      createdAt: new Date().toISOString()
    };

    customerSubscriptions.set(subscriptionId, subscription);
    plan.subscriberCount++;

    // Schedule automated billing
    scheduleAutomatedBilling(subscriptionId);

    return {
      success: true,
      message: "Subscription created successfully",
      subscription: {
        id: subscriptionId,
        customer: customerEmail,
        plan: plan.name,
        status: subscription.status,
        nextBilling: subscription.nextBillingDate,
        effectivePrice: subscription.pricing.effectivePrice,
        paymentMethod: paymentMethod.type
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to create subscription: ${error.message}`
    };
  }
});

// Track usage for billing
server.registerTool("track_usage", {
  title: "Track Resource Usage",
  description: "Record usage metrics for billing calculations",
  inputSchema: {
    customerId: { type: "string", description: "Customer identifier" },
    subscriptionId: { type: "string", description: "Subscription ID" },
    usageType: {
      type: "string",
      enum: ["storage", "inference", "bandwidth", "compute"],
      description: "Type of resource used"
    },
    amount: { type: "number", description: "Usage amount" },
    unit: { type: "string", description: "Usage unit (GB, queries, hours, etc.)" },
    metadata: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node that provided service" },
        modelId: { type: "string", description: "AI model used" },
        duration: { type: "number", description: "Service duration" },
        quality: { type: "string", description: "Service quality tier" }
      }
    }
  }
}, async (customerId, subscriptionId, usageType, amount, unit, metadata = {}) => {
  try {
    const subscription = customerSubscriptions.get(subscriptionId);
    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    const usageKey = `${subscriptionId}_${getCurrentBillingPeriod(subscription)}`;
    
    if (!usageTracking.has(usageKey)) {
      usageTracking.set(usageKey, {
        subscriptionId,
        period: getCurrentBillingPeriod(subscription),
        storage: [],
        inference: [],
        bandwidth: [],
        compute: []
      });
    }

    const usage = usageTracking.get(usageKey);
    const usageRecord = {
      timestamp: new Date().toISOString(),
      amount,
      unit,
      ...metadata
    };

    // Add to appropriate usage category
    switch (usageType) {
      case 'storage':
        usage.storage.push(usageRecord);
        subscription.usage.currentCycle.storage += amount;
        break;
      case 'inference':
        usage.inference.push(usageRecord);
        subscription.usage.currentCycle.queries += amount;
        break;
      case 'bandwidth':
        usage.bandwidth.push(usageRecord);
        subscription.usage.currentCycle.bandwidth += amount;
        break;
      case 'compute':
        usage.compute.push(usageRecord);
        subscription.usage.currentCycle.computeHours += amount;
        break;
    }

    // Check if usage limits are exceeded
    const limitWarnings = checkUsageLimits(subscription);

    return {
      success: true,
      message: "Usage tracked successfully",
      usage: {
        type: usageType,
        amount,
        unit,
        currentTotal: subscription.usage.currentCycle[usageType === 'inference' ? 'queries' : usageType === 'compute' ? 'computeHours' : usageType],
        limit: subscription.usage.limits[usageType === 'inference' ? 'maxQueries' : usageType === 'storage' ? 'maxStorage' : 'unlimited'],
        warnings: limitWarnings
      },
      recordedAt: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to track usage: ${error.message}`
    };
  }
});

// Generate invoice
server.registerTool("generate_invoice", {
  title: "Generate Invoice",
  description: "Create invoice for subscription and usage charges",
  inputSchema: {
    subscriptionId: { type: "string", description: "Subscription to bill" },
    billingPeriod: { type: "string", description: "Billing period (ISO date range)" },
    includeUsage: { type: "boolean", description: "Include usage-based charges" },
    customCharges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          quantity: { type: "number" }
        }
      }
    }
  }
}, async (subscriptionId, billingPeriod = null, includeUsage = true, customCharges = []) => {
  try {
    const subscription = customerSubscriptions.get(subscriptionId);
    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    const plan = billingPlans.get(subscription.planId);
    const period = billingPeriod || getCurrentBillingPeriod(subscription);
    const usageKey = `${subscriptionId}_${period}`;
    const usage = usageTracking.get(usageKey) || {};

    const invoiceId = `inv_${Date.now()}`;
    const invoice = {
      id: invoiceId,
      subscriptionId,
      customerId: subscription.customerId,
      customerEmail: subscription.customerEmail,
      billingPeriod: period,
      status: 'pending',
      lineItems: [],
      subtotal: 0,
      taxes: 0,
      total: 0,
      currency: subscription.pricing.currency,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      createdAt: new Date().toISOString()
    };

    // Add subscription base charge
    if (subscription.pricing.basePrice > 0) {
      invoice.lineItems.push({
        description: `${plan.name} - ${subscription.pricing.billingCycle} subscription`,
        quantity: 1,
        unitPrice: subscription.pricing.effectivePrice,
        total: subscription.pricing.effectivePrice
      });
      invoice.subtotal += subscription.pricing.effectivePrice;
    }

    // Add usage-based charges
    if (includeUsage && usage) {
      const usageCharges = calculateUsageCharges(usage, plan.pricing.usageRates);
      
      for (const [type, charge] of Object.entries(usageCharges)) {
        if (charge.total > 0) {
          invoice.lineItems.push({
            description: `${type} usage - ${charge.quantity} ${charge.unit}`,
            quantity: charge.quantity,
            unitPrice: charge.rate,
            total: charge.total
          });
          invoice.subtotal += charge.total;
        }
      }
    }

    // Add custom charges
    for (const charge of customCharges) {
      const lineTotal = charge.amount * (charge.quantity || 1);
      invoice.lineItems.push({
        description: charge.description,
        quantity: charge.quantity || 1,
        unitPrice: charge.amount,
        total: lineTotal
      });
      invoice.subtotal += lineTotal;
    }

    // Calculate taxes (simplified)
    invoice.taxes = invoice.subtotal * 0.1; // 10% tax
    invoice.total = invoice.subtotal + invoice.taxes;

    invoices.set(invoiceId, invoice);

    return {
      success: true,
      message: "Invoice generated successfully",
      invoice: {
        id: invoiceId,
        customer: subscription.customerEmail,
        period: period,
        subtotal: invoice.subtotal,
        taxes: invoice.taxes,
        total: invoice.total,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        status: invoice.status,
        lineItems: invoice.lineItems.length,
        paymentDue: invoice.total > 0
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to generate invoice: ${error.message}`
    };
  }
});

// Process automatic payment
server.registerTool("process_payment", {
  title: "Process Payment",
  description: "Automatically collect payment for invoice using customer's payment method",
  inputSchema: {
    invoiceId: { type: "string", description: "Invoice to pay" },
    paymentMethod: { type: "string", description: "Override payment method" },
    retryOnFailure: { type: "boolean", description: "Retry payment if failed" }
  }
}, async (invoiceId, paymentMethod = null, retryOnFailure = true) => {
  try {
    const invoice = invoices.get(invoiceId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    const subscription = customerSubscriptions.get(invoice.subscriptionId);
    const payment = paymentMethod || subscription.paymentMethod;

    let paymentResult;

    // Process payment based on method type
    switch (payment.type) {
      case 'bitcoin_wallet':
        paymentResult = await processBitcoinPayment(invoice, payment);
        break;
      case 'lightning_wallet':
        paymentResult = await processLightningPayment(invoice, payment);
        break;
      case 'virtual_card':
        paymentResult = await processCardPayment(invoice, payment);
        break;
      default:
        return { success: false, error: "Unsupported payment method" };
    }

    // Update invoice and subscription
    if (paymentResult.success) {
      invoice.status = 'paid';
      invoice.paidAt = new Date().toISOString();
      invoice.paymentId = paymentResult.paymentId;
      
      subscription.billingHistory.push({
        invoiceId,
        amount: invoice.total,
        currency: invoice.currency,
        paidAt: invoice.paidAt,
        paymentMethod: payment.type
      });
      
      subscription.totalBilled += invoice.total;
      subscription.nextBillingDate = calculateNextBillingDate(
        subscription.pricing.billingCycle,
        subscription.nextBillingDate
      );

      // Reset usage tracking for new cycle
      resetUsageTracking(subscription.id);
    } else if (retryOnFailure) {
      // Schedule retry
      schedulePaymentRetry(invoiceId, payment);
    }

    return {
      success: paymentResult.success,
      message: paymentResult.success ? "Payment processed successfully" : "Payment failed",
      payment: {
        invoiceId,
        amount: invoice.total,
        currency: invoice.currency,
        method: payment.type,
        status: paymentResult.success ? 'completed' : 'failed',
        transactionId: paymentResult.paymentId,
        error: paymentResult.error,
        nextBilling: subscription.nextBillingDate,
        retryScheduled: !paymentResult.success && retryOnFailure
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to process payment: ${error.message}`
    };
  }
});

// Get billing analytics
server.registerTool("get_billing_analytics", {
  title: "Get Billing Analytics",
  description: "Get comprehensive billing and revenue analytics",
  inputSchema: {
    timeframe: {
      type: "string",
      enum: ["7d", "30d", "90d", "12m"],
      description: "Analytics timeframe"
    },
    customerId: { type: "string", description: "Filter by customer" },
    planId: { type: "string", description: "Filter by billing plan" }
  }
}, async (timeframe = "30d", customerId = null, planId = null) => {
  try {
    const analytics = generateBillingAnalytics(timeframe, customerId, planId);

    return {
      success: true,
      analytics: {
        timeframe,
        summary: {
          totalRevenue: analytics.totalRevenue,
          totalInvoices: analytics.totalInvoices,
          paidInvoices: analytics.paidInvoices,
          pendingAmount: analytics.pendingAmount,
          subscriptions: analytics.activeSubscriptions,
          churnRate: analytics.churnRate,
          averageRevenuePerUser: analytics.arpu
        },
        breakdown: {
          byPlan: analytics.revenueByPlan,
          byPaymentMethod: analytics.paymentMethods,
          byUsageType: analytics.usageRevenue
        },
        trends: {
          monthlyRecurringRevenue: analytics.mrrTrend,
          subscriptionGrowth: analytics.subscriptionGrowth,
          usageGrowth: analytics.usageGrowth
        },
        topCustomers: analytics.topCustomers,
        upcomingBilling: analytics.upcomingBilling
      },
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to get billing analytics: ${error.message}`
    };
  }
});

// Helper Functions

function calculateEffectivePrice(basePrice, customPricing) {
  let effective = customPricing.customRate || basePrice;
  if (customPricing.discount) {
    effective = effective * (1 - customPricing.discount / 100);
  }
  return effective;
}

function calculateNextBillingDate(billingCycle, fromDate = null) {
  const baseDate = fromDate ? new Date(fromDate) : new Date();
  
  switch (billingCycle) {
    case 'daily':
      return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case 'weekly':
      return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'monthly':
      const nextMonth = new Date(baseDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth.toISOString();
    case 'quarterly':
      const nextQuarter = new Date(baseDate);
      nextQuarter.setMonth(nextQuarter.getMonth() + 3);
      return nextQuarter.toISOString();
    case 'yearly':
      const nextYear = new Date(baseDate);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      return nextYear.toISOString();
    default:
      return new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}

function getCurrentBillingPeriod(subscription) {
  const now = new Date();
  const start = new Date(subscription.nextBillingDate);
  start.setMonth(start.getMonth() - 1); // Go back one cycle
  
  return `${start.toISOString().split('T')[0]}_${now.toISOString().split('T')[0]}`;
}

function checkUsageLimits(subscription) {
  const warnings = [];
  const usage = subscription.usage.currentCycle;
  const limits = subscription.usage.limits;

  if (usage.storage > limits.maxStorage * 0.8) {
    warnings.push(`Storage usage at ${Math.round(usage.storage / limits.maxStorage * 100)}% of limit`);
  }
  
  if (usage.queries > limits.maxQueries * 0.8) {
    warnings.push(`Query usage at ${Math.round(usage.queries / limits.maxQueries * 100)}% of limit`);
  }

  return warnings;
}

function calculateUsageCharges(usage, rates) {
  const charges = {};

  if (usage.storage && rates.storagePerGB) {
    const totalGB = usage.storage.reduce((sum, record) => sum + record.amount, 0);
    charges.storage = {
      quantity: totalGB,
      unit: 'GB',
      rate: rates.storagePerGB,
      total: totalGB * rates.storagePerGB
    };
  }

  if (usage.inference && rates.inferencePerQuery) {
    const totalQueries = usage.inference.length;
    charges.inference = {
      quantity: totalQueries,
      unit: 'queries',
      rate: rates.inferencePerQuery,
      total: totalQueries * rates.inferencePerQuery
    };
  }

  if (usage.bandwidth && rates.bandwidthPerGB) {
    const totalGB = usage.bandwidth.reduce((sum, record) => sum + record.amount, 0);
    charges.bandwidth = {
      quantity: totalGB,
      unit: 'GB',
      rate: rates.bandwidthPerGB,
      total: totalGB * rates.bandwidthPerGB
    };
  }

  if (usage.compute && rates.computePerHour) {
    const totalHours = usage.compute.reduce((sum, record) => sum + record.amount, 0);
    charges.compute = {
      quantity: totalHours,
      unit: 'hours',
      rate: rates.computePerHour,
      total: totalHours * rates.computePerHour
    };
  }

  return charges;
}

function scheduleAutomatedBilling(subscriptionId) {
  const subscription = customerSubscriptions.get(subscriptionId);
  if (!subscription) return;

  const billingDate = new Date(subscription.nextBillingDate);
  const cronExpression = `0 0 ${billingDate.getDate()} * *`; // Monthly on the same day

  const job = cron.schedule(cronExpression, async () => {
    try {
      // Generate and process invoice automatically
      const invoiceResult = await server.call_tool('generate_invoice', {
        subscriptionId,
        includeUsage: true
      });

      if (invoiceResult.success) {
        await server.call_tool('process_payment', {
          invoiceId: invoiceResult.invoice.id,
          retryOnFailure: true
        });
      }
    } catch (error) {
      console.error(`Automated billing failed for ${subscriptionId}:`, error);
    }
  }, { scheduled: false });

  billingJobs.set(subscriptionId, job);
  job.start();
}

async function processBitcoinPayment(invoice, paymentMethod) {
  try {
    // Create Bitcoin payment request
    const options = {
      method: 'POST',
      url: 'https://sandboxapi.bitnob.co/api/v1/wallets/send_bitcoin',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${config.API_KEY}`
      },
      data: {
        satoshis: Math.round(invoice.total * 100000000 / 50000), // Convert USD to sats
        address: paymentMethod.details.address,
        customerEmail: invoice.customerEmail,
        description: `Invoice payment: ${invoice.id}`,
        priorityLevel: 'regular'
      }
    };

    const response = await axios.request(options);
    return {
      success: true,
      paymentId: response.data.id
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function processLightningPayment(invoice, paymentMethod) {
  try {
    // Create Lightning invoice
    const options = {
      method: 'POST',
      url: 'https://sandboxapi.bitnob.co/api/v1/wallets/ln/createinvoice',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${config.API_KEY}`
      },
      data: {
        satoshis: Math.round(invoice.total * 100000000 / 50000),
        customerEmail: invoice.customerEmail,
        description: `Invoice payment: ${invoice.id}`,
        expiresAt: '24h'
      }
    };

    const response = await axios.request(options);
    return {
      success: true,
      paymentId: response.data.id,
      paymentRequest: response.data.request
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function processCardPayment(invoice, paymentMethod) {
  // Mock card payment processing
  return {
    success: Math.random() > 0.1, // 90% success rate
    paymentId: `card_${Date.now()}`,
    error: Math.random() > 0.1 ? null : 'Insufficient funds'
  };
}

function schedulePaymentRetry(invoiceId, paymentMethod) {
  // Schedule retry in 24 hours
  setTimeout(async () => {
    try {
      await server.call_tool('process_payment', {
        invoiceId,
        retryOnFailure: false
      });
    } catch (error) {
      console.error(`Payment retry failed for ${invoiceId}:`, error);
    }
  }, 24 * 60 * 60 * 1000);
}

function resetUsageTracking(subscriptionId) {
  const subscription = customerSubscriptions.get(subscriptionId);
  if (subscription) {
    subscription.usage.currentCycle = {
      storage: 0,
      queries: 0,
      bandwidth: 0,
      computeHours: 0
    };
  }
}

function generateBillingAnalytics(timeframe, customerId, planId) {
  // Mock analytics - implement with actual data
  return {
    totalRevenue: 12500,
    totalInvoices: 145,
    paidInvoices: 138,
    pendingAmount: 850,
    activeSubscriptions: 42,
    churnRate: 0.05,
    arpu: 297.62,
    revenueByPlan: {
      'basic': 3500,
      'premium': 6000,
      'enterprise': 3000
    },
    paymentMethods: {
      'bitcoin_wallet': 60,
      'lightning_wallet': 25,
      'virtual_card': 15
    },
    usageRevenue: {
      'storage': 4200,
      'inference': 5800,
      'bandwidth': 1500,
      'compute': 1000
    },
    mrrTrend: 'increasing',
    subscriptionGrowth: 15,
    usageGrowth: 22,
    topCustomers: [],
    upcomingBilling: []
  };
}

// Start the MCP server
const transport = new StdioServerTransport();
await server.connect(transport);