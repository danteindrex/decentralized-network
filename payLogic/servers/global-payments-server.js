/**
 * Global Payment Capabilities MCP Server
 * Handles international payments, virtual cards, and multi-currency operations
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from 'axios';
import config from '../configs/config.js';

const server = new McpServer({
  name: "global-payments",
  version: "1.0.0"
});

// Supported currencies and regions
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'ZAR'];
const SUPPORTED_REGIONS = ['US', 'EU', 'UK', 'NG', 'KE', 'GH', 'ZA'];

// Create virtual card for global payments
server.registerTool("create_virtual_card", {
  title: "Create Virtual Card",
  description: "Issue a USD virtual card for global online payments",
  inputSchema: {
    cardId: { type: "string", description: "Unique card identifier" },
    customerEmail: { type: "string", description: "Customer email address" },
    cardType: { 
      type: "string", 
      enum: ["standard", "premium", "business"],
      description: "Type of virtual card"
    },
    limits: {
      type: "object",
      properties: {
        daily: { type: "number", description: "Daily spending limit (USD)" },
        monthly: { type: "number", description: "Monthly spending limit (USD)" },
        perTransaction: { type: "number", description: "Per transaction limit (USD)" }
      }
    },
    restrictions: {
      type: "object",
      properties: {
        allowedRegions: {
          type: "array",
          items: { type: "string" },
          description: "Allowed regions for transactions"
        },
        blockedMerchants: {
          type: "array", 
          items: { type: "string" },
          description: "Blocked merchant categories"
        },
        onlineOnly: { type: "boolean", description: "Restrict to online payments only" }
      }
    }
  }
}, async (cardId, customerEmail, cardType = "standard", limits = {}, restrictions = {}) => {
  try {
    const cardLimits = {
      daily: limits.daily || (cardType === "business" ? 5000 : cardType === "premium" ? 2000 : 500),
      monthly: limits.monthly || (cardType === "business" ? 50000 : cardType === "premium" ? 10000 : 5000),
      perTransaction: limits.perTransaction || (cardType === "business" ? 2000 : 1000)
    };

    const cardRestrictions = {
      allowedRegions: restrictions.allowedRegions || SUPPORTED_REGIONS,
      blockedMerchants: restrictions.blockedMerchants || [],
      onlineOnly: restrictions.onlineOnly !== false
    };

    const options = {
      method: 'POST',
      url: 'https://sandboxapi.bitnob.co/api/v1/cards/virtual/create',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${config.API_KEY}`
      },
      data: {
        customerEmail,
        cardType,
        limits: cardLimits,
        restrictions: cardRestrictions,
        metadata: {
          cardId,
          createdBy: 'decentralized-ai-network',
          purpose: 'global-payments'
        }
      }
    };

    const response = await axios.request(options);
    const cardData = response.data;

    return {
      success: true,
      message: "Virtual card created successfully",
      card: {
        id: cardId,
        cardNumber: cardData.cardNumber,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cvv: cardData.cvv,
        balance: 0,
        status: "active",
        type: cardType,
        limits: cardLimits,
        restrictions: cardRestrictions,
        supportedRegions: SUPPORTED_REGIONS,
        createdAt: new Date().toISOString()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to create virtual card: ${error.message}`
    };
  }
});

// Fund virtual card
server.registerTool("fund_virtual_card", {
  title: "Fund Virtual Card",
  description: "Load virtual card with funds from Bitcoin or other sources",
  inputSchema: {
    cardId: { type: "string", description: "Card ID to fund" },
    amount: { type: "number", description: "Amount to fund (USD)" },
    source: {
      type: "string",
      enum: ["bitcoin_wallet", "lightning_wallet", "bank_transfer", "crypto_convert"],
      description: "Funding source"
    },
    sourceDetails: {
      type: "object",
      properties: {
        btcAmount: { type: "number", description: "BTC amount if crypto source" },
        conversionRate: { type: "number", description: "BTC to USD rate" },
        bankAccount: { type: "string", description: "Bank account if bank transfer" }
      }
    }
  }
}, async (cardId, amount, source, sourceDetails = {}) => {
  try {
    let fundingData = {
      cardId,
      amount,
      currency: 'USD',
      source
    };

    // Handle different funding sources
    switch (source) {
      case 'bitcoin_wallet':
        fundingData.btcAmount = sourceDetails.btcAmount || (amount / (sourceDetails.conversionRate || 50000));
        fundingData.conversionRate = sourceDetails.conversionRate || await getCurrentBTCRate();
        break;
      
      case 'lightning_wallet':
        fundingData.satoshis = Math.round(amount * 100000000 / (sourceDetails.conversionRate || 50000));
        break;
      
      case 'crypto_convert':
        fundingData.sourceAmount = sourceDetails.btcAmount;
        fundingData.targetCurrency = 'USD';
        break;
    }

    const options = {
      method: 'POST',
      url: 'https://sandboxapi.bitnob.co/api/v1/cards/virtual/fund',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${config.API_KEY}`
      },
      data: fundingData
    };

    const response = await axios.request(options);
    const result = response.data;

    return {
      success: true,
      message: "Card funded successfully",
      funding: {
        cardId,
        amountFunded: amount,
        currency: 'USD',
        source,
        transactionId: result.transactionId,
        newBalance: result.newBalance,
        conversionDetails: source.includes('bitcoin') || source.includes('crypto') ? {
          btcAmount: fundingData.btcAmount || fundingData.sourceAmount,
          conversionRate: fundingData.conversionRate,
          fees: result.conversionFees
        } : null,
        fundedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to fund card: ${error.message}`
    };
  }
});

// International payment processing
server.registerTool("process_international_payment", {
  title: "Process International Payment",
  description: "Send payments to international recipients with automatic currency conversion",
  inputSchema: {
    paymentId: { type: "string", description: "Unique payment identifier" },
    recipient: {
      type: "object",
      properties: {
        email: { type: "string", description: "Recipient email" },
        name: { type: "string", description: "Recipient name" },
        country: { type: "string", description: "Recipient country code" },
        bankAccount: { type: "string", description: "Bank account or wallet address" },
        preferredCurrency: { type: "string", description: "Preferred receiving currency" }
      }
    },
    amount: { type: "number", description: "Amount to send" },
    sourceCurrency: { type: "string", description: "Source currency (BTC, USD, etc.)" },
    targetCurrency: { type: "string", description: "Target currency for recipient" },
    paymentMethod: {
      type: "string",
      enum: ["bank_transfer", "mobile_money", "crypto_wallet", "virtual_card"],
      description: "Payment delivery method"
    },
    memo: { type: "string", description: "Payment description/memo" }
  }
}, async (paymentId, recipient, amount, sourceCurrency, targetCurrency, paymentMethod, memo = "") => {
  try {
    // Get conversion rate
    const conversionRate = await getConversionRate(sourceCurrency, targetCurrency);
    const convertedAmount = amount * conversionRate;
    
    // Validate recipient country and payment method
    const paymentOptions = await getPaymentOptions(recipient.country, targetCurrency);
    
    if (!paymentOptions.methods.includes(paymentMethod)) {
      return {
        success: false,
        error: `Payment method ${paymentMethod} not available in ${recipient.country}`
      };
    }

    const paymentData = {
      paymentId,
      recipient: {
        email: recipient.email,
        name: recipient.name,
        country: recipient.country,
        accountDetails: recipient.bankAccount
      },
      amount: {
        source: amount,
        sourceCurrency,
        target: convertedAmount,
        targetCurrency,
        conversionRate,
        fees: calculateInternationalFees(amount, sourceCurrency, targetCurrency, paymentMethod)
      },
      method: paymentMethod,
      memo,
      estimatedDelivery: calculateDeliveryTime(recipient.country, paymentMethod)
    };

    const options = {
      method: 'POST',
      url: 'https://sandboxapi.bitnob.co/api/v1/payments/international',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${config.API_KEY}`
      },
      data: paymentData
    };

    const response = await axios.request(options);
    const result = response.data;

    return {
      success: true,
      message: "International payment initiated successfully",
      payment: {
        id: paymentId,
        status: result.status || 'processing',
        recipient: {
          name: recipient.name,
          country: recipient.country,
          currency: targetCurrency
        },
        amounts: {
          sent: `${amount} ${sourceCurrency}`,
          received: `${convertedAmount} ${targetCurrency}`,
          fees: paymentData.amount.fees,
          conversionRate
        },
        method: paymentMethod,
        estimatedDelivery: paymentData.estimatedDelivery,
        trackingId: result.trackingId,
        createdAt: new Date().toISOString()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to process international payment: ${error.message}`
    };
  }
});

// Get supported payment methods by country
server.registerTool("get_payment_methods", {
  title: "Get Payment Methods",
  description: "Get available payment methods and currencies for specific countries",
  inputSchema: {
    country: { type: "string", description: "Country code (e.g., 'NG', 'KE', 'US')" },
    currency: { type: "string", description: "Currency code (optional)" }
  }
}, async (country, currency = null) => {
  try {
    const paymentOptions = await getPaymentOptions(country, currency);
    
    return {
      success: true,
      country,
      supportedCurrencies: paymentOptions.currencies,
      paymentMethods: paymentOptions.methods.map(method => ({
        method,
        name: getPaymentMethodName(method),
        processingTime: getProcessingTime(method, country),
        fees: getMethodFees(method, country),
        limits: getMethodLimits(method, country)
      })),
      exchangeRates: currency ? {
        [currency]: await getConversionRate('USD', currency)
      } : await getAllExchangeRates(),
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to get payment methods: ${error.message}`
    };
  }
});

// Currency conversion service
server.registerTool("convert_currency", {
  title: "Convert Currency",
  description: "Convert between different currencies including Bitcoin",
  inputSchema: {
    amount: { type: "number", description: "Amount to convert" },
    fromCurrency: { type: "string", description: "Source currency code" },
    toCurrency: { type: "string", description: "Target currency code" },
    includeRates: { type: "boolean", description: "Include detailed rate information" }
  }
}, async (amount, fromCurrency, toCurrency, includeRates = false) => {
  try {
    const rate = await getConversionRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rate;
    const fees = calculateConversionFees(amount, fromCurrency, toCurrency);
    
    const result = {
      success: true,
      conversion: {
        original: {
          amount,
          currency: fromCurrency
        },
        converted: {
          amount: convertedAmount,
          currency: toCurrency
        },
        rate,
        fees,
        netAmount: convertedAmount - fees,
        timestamp: new Date().toISOString()
      }
    };

    if (includeRates) {
      result.rateDetails = {
        provider: 'bitnob',
        spread: 0.5, // 0.5% spread
        lastUpdated: new Date().toISOString(),
        volatility: calculateVolatility(fromCurrency, toCurrency),
        trend: await getRateTrend(fromCurrency, toCurrency)
      };
    }

    return result;

  } catch (error) {
    return {
      success: false,
      error: `Failed to convert currency: ${error.message}`
    };
  }
});

// Global payment status tracking
server.registerTool("track_global_payment", {
  title: "Track Global Payment",
  description: "Track the status of international payments with real-time updates",
  inputSchema: {
    paymentId: { type: "string", description: "Payment ID to track" },
    trackingId: { type: "string", description: "Alternative tracking ID" }
  }
}, async (paymentId = null, trackingId = null) => {
  try {
    const identifier = paymentId || trackingId;
    if (!identifier) {
      return {
        success: false,
        error: "Either paymentId or trackingId is required"
      };
    }

    const options = {
      method: 'GET',
      url: `https://sandboxapi.bitnob.co/api/v1/payments/track/${identifier}`,
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${config.API_KEY}`
      }
    };

    const response = await axios.request(options);
    const payment = response.data;

    return {
      success: true,
      tracking: {
        paymentId: payment.id,
        trackingId: payment.trackingId,
        status: payment.status,
        statusMessage: getStatusMessage(payment.status),
        progress: getPaymentProgress(payment.status),
        timeline: payment.timeline || [],
        recipient: {
          name: payment.recipientName,
          country: payment.recipientCountry,
          method: payment.paymentMethod
        },
        amounts: {
          sent: payment.sentAmount,
          received: payment.receivedAmount,
          fees: payment.fees
        },
        estimatedCompletion: payment.estimatedCompletion,
        actualCompletion: payment.completedAt,
        canCancel: payment.status === 'processing' || payment.status === 'pending',
        supportContact: {
          email: 'support@bitnob.co',
          phone: '+1-234-567-8900'
        }
      },
      checkedAt: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to track payment: ${error.message}`
    };
  }
});

// Helper Functions

async function getCurrentBTCRate() {
  try {
    const response = await axios.get('https://api.coindesk.com/v1/bpi/currentprice/USD.json');
    return parseFloat(response.data.bpi.USD.rate.replace(/,/g, ''));
  } catch (error) {
    return 50000; // Fallback rate
  }
}

async function getConversionRate(fromCurrency, toCurrency) {
  // Mock implementation - replace with actual rate API
  const rates = {
    'BTC_USD': await getCurrentBTCRate(),
    'USD_EUR': 0.85,
    'USD_GBP': 0.73,
    'USD_NGN': 460,
    'USD_KES': 110,
    'USD_GHS': 12,
    'USD_ZAR': 18
  };

  const rateKey = `${fromCurrency}_${toCurrency}`;
  if (rates[rateKey]) {
    return rates[rateKey];
  }

  // Reverse lookup
  const reverseKey = `${toCurrency}_${fromCurrency}`;
  if (rates[reverseKey]) {
    return 1 / rates[reverseKey];
  }

  // Cross conversion via USD
  if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
    const fromUSD = rates[`${fromCurrency}_USD`] || (1 / rates[`USD_${fromCurrency}`]);
    const toUSD = rates[`USD_${toCurrency}`] || (1 / rates[`${toCurrency}_USD`]);
    return fromUSD * toUSD;
  }

  return 1; // Same currency
}

async function getPaymentOptions(country, currency) {
  const countryOptions = {
    'US': { currencies: ['USD'], methods: ['bank_transfer', 'virtual_card', 'crypto_wallet'] },
    'NG': { currencies: ['NGN', 'USD'], methods: ['bank_transfer', 'mobile_money', 'crypto_wallet'] },
    'KE': { currencies: ['KES', 'USD'], methods: ['mobile_money', 'bank_transfer', 'crypto_wallet'] },
    'GH': { currencies: ['GHS', 'USD'], methods: ['mobile_money', 'bank_transfer'] },
    'ZA': { currencies: ['ZAR', 'USD'], methods: ['bank_transfer', 'virtual_card'] },
    'GB': { currencies: ['GBP', 'USD', 'EUR'], methods: ['bank_transfer', 'virtual_card'] }
  };

  return countryOptions[country] || { currencies: ['USD'], methods: ['crypto_wallet'] };
}

function calculateInternationalFees(amount, fromCurrency, toCurrency, method) {
  let baseFee = 0.02; // 2% base fee
  
  if (method === 'mobile_money') baseFee = 0.015; // 1.5% for mobile money
  if (method === 'crypto_wallet') baseFee = 0.005; // 0.5% for crypto
  if (fromCurrency === 'BTC') baseFee += 0.01; // Additional 1% for crypto conversion
  
  return amount * baseFee;
}

function calculateDeliveryTime(country, method) {
  const deliveryTimes = {
    'mobile_money': '5-30 minutes',
    'crypto_wallet': '1-10 minutes',
    'bank_transfer': {
      'US': '1-2 business days',
      'NG': '2-4 hours',
      'KE': '5-30 minutes',
      'default': '1-3 business days'
    },
    'virtual_card': 'Instant'
  };

  if (typeof deliveryTimes[method] === 'string') {
    return deliveryTimes[method];
  }

  return deliveryTimes[method][country] || deliveryTimes[method]['default'];
}

function getPaymentMethodName(method) {
  const names = {
    'bank_transfer': 'Bank Transfer',
    'mobile_money': 'Mobile Money',
    'crypto_wallet': 'Crypto Wallet',
    'virtual_card': 'Virtual Card'
  };
  return names[method] || method;
}

function getProcessingTime(method, country) {
  return calculateDeliveryTime(country, method);
}

function getMethodFees(method, country) {
  // Simplified fee structure
  return {
    percentage: method === 'crypto_wallet' ? 0.5 : method === 'mobile_money' ? 1.5 : 2.0,
    fixed: 0.5,
    currency: 'USD'
  };
}

function getMethodLimits(method, country) {
  return {
    min: 1,
    max: method === 'crypto_wallet' ? 50000 : 10000,
    daily: 25000,
    monthly: 100000,
    currency: 'USD'
  };
}

async function getAllExchangeRates() {
  const rates = {};
  for (const currency of SUPPORTED_CURRENCIES) {
    if (currency !== 'USD') {
      rates[currency] = await getConversionRate('USD', currency);
    }
  }
  rates['BTC'] = 1 / await getCurrentBTCRate();
  return rates;
}

function calculateConversionFees(amount, fromCurrency, toCurrency) {
  return amount * 0.005; // 0.5% conversion fee
}

function calculateVolatility(fromCurrency, toCurrency) {
  if (fromCurrency === 'BTC' || toCurrency === 'BTC') return 'high';
  return 'low';
}

async function getRateTrend(fromCurrency, toCurrency) {
  // Mock trend data
  return Math.random() > 0.5 ? 'increasing' : 'decreasing';
}

function getStatusMessage(status) {
  const messages = {
    'pending': 'Payment is being processed',
    'processing': 'Payment is in progress',
    'completed': 'Payment has been delivered successfully',
    'failed': 'Payment could not be completed',
    'cancelled': 'Payment was cancelled'
  };
  return messages[status] || 'Unknown status';
}

function getPaymentProgress(status) {
  const progress = {
    'pending': 25,
    'processing': 50,
    'confirming': 75,
    'completed': 100,
    'failed': 0,
    'cancelled': 0
  };
  return progress[status] || 0;
}

// Start the MCP server
const transport = new StdioServerTransport();
await server.connect(transport);