/**
 * Real-Time Transaction Monitoring MCP Server
 * Provides live transaction tracking, alerts, and analytics
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from 'axios';
import EventEmitter from 'events';
import WebSocket from 'ws';
import config from '../configs/config.js';

const server = new McpServer({
  name: "transaction-monitor",
  version: "1.0.0"
});

// Event emitter for real-time updates
const transactionEvents = new EventEmitter();

// In-memory storage for monitoring data
const activeMonitors = new Map();
const transactionHistory = [];
const alerts = [];

// Start transaction monitoring
server.registerTool("start_monitoring", {
  title: "Start Transaction Monitoring",
  description: "Begin real-time monitoring of Bitcoin and Lightning transactions",
  inputSchema: {
    monitorId: { type: "string", description: "Unique monitor identifier" },
    type: { 
      type: "string", 
      enum: ["all", "bitcoin", "lightning", "virtual_card"],
      description: "Type of transactions to monitor"
    },
    filters: {
      type: "object",
      properties: {
        minAmount: { type: "number", description: "Minimum transaction amount (BTC)" },
        maxAmount: { type: "number", description: "Maximum transaction amount (BTC)" },
        addresses: { 
          type: "array", 
          items: { type: "string" },
          description: "Specific addresses to monitor"
        },
        status: {
          type: "array",
          items: { 
            type: "string",
            enum: ["pending", "confirmed", "failed", "expired"]
          },
          description: "Transaction statuses to monitor"
        }
      }
    },
    alertRules: {
      type: "object",
      properties: {
        largeTransaction: { type: "number", description: "Alert threshold for large transactions" },
        failedTransaction: { type: "boolean", description: "Alert on failed transactions" },
        webhookUrl: { type: "string", description: "Webhook URL for alerts" },
        emailAlert: { type: "string", description: "Email for alerts" }
      }
    }
  }
}, async (monitorId, type = "all", filters = {}, alertRules = {}) => {
  try {
    const monitor = {
      id: monitorId,
      type,
      filters: {
        minAmount: filters.minAmount || 0,
        maxAmount: filters.maxAmount || Infinity,
        addresses: filters.addresses || [],
        status: filters.status || ["pending", "confirmed", "failed"]
      },
      alertRules: {
        largeTransaction: alertRules.largeTransaction || 0.1,
        failedTransaction: alertRules.failedTransaction !== false,
        webhookUrl: alertRules.webhookUrl,
        emailAlert: alertRules.emailAlert
      },
      startTime: new Date().toISOString(),
      isActive: true,
      transactionCount: 0,
      lastActivity: null
    };

    activeMonitors.set(monitorId, monitor);

    // Start polling for transactions
    startTransactionPolling(monitorId);

    return {
      success: true,
      message: "Transaction monitoring started successfully",
      monitor: {
        id: monitorId,
        type,
        startTime: monitor.startTime,
        status: "active"
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to start monitoring: ${error.message}`
    };
  }
});

// Get live transaction feed
server.registerTool("get_live_transactions", {
  title: "Get Live Transaction Feed",
  description: "Get real-time stream of transactions with optional filtering",
  inputSchema: {
    limit: { type: "number", description: "Number of recent transactions (default: 50)" },
    type: { 
      type: "string", 
      enum: ["all", "bitcoin", "lightning", "virtual_card"],
      description: "Transaction type filter"
    },
    status: { 
      type: "string", 
      enum: ["all", "pending", "confirmed", "failed"],
      description: "Status filter"
    }
  }
}, async (limit = 50, type = "all", status = "all") => {
  try {
    // Get recent transactions from Bitnob API
    const transactions = await fetchRecentTransactions(limit);
    
    // Apply filters
    let filteredTransactions = transactions;
    
    if (type !== "all") {
      filteredTransactions = filteredTransactions.filter(tx => tx.type === type);
    }
    
    if (status !== "all") {
      filteredTransactions = filteredTransactions.filter(tx => tx.status === status);
    }

    // Enrich with real-time data
    const enrichedTransactions = await Promise.all(
      filteredTransactions.map(async (tx) => {
        const enriched = await enrichTransactionData(tx);
        return enriched;
      })
    );

    return {
      success: true,
      transactions: enrichedTransactions.slice(0, limit),
      totalCount: enrichedTransactions.length,
      timestamp: new Date().toISOString(),
      filters: { type, status, limit }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to get transactions: ${error.message}`
    };
  }
});

// Get transaction analytics
server.registerTool("get_transaction_analytics", {
  title: "Get Transaction Analytics",
  description: "Get comprehensive analytics and insights on transaction patterns",
  inputSchema: {
    timeframe: { 
      type: "string", 
      enum: ["1h", "24h", "7d", "30d"],
      description: "Analytics timeframe"
    },
    groupBy: {
      type: "string",
      enum: ["hour", "day", "week", "month"],
      description: "Data grouping interval"
    }
  }
}, async (timeframe = "24h", groupBy = "hour") => {
  try {
    const analytics = await generateTransactionAnalytics(timeframe, groupBy);
    
    return {
      success: true,
      analytics: {
        timeframe,
        groupBy,
        summary: {
          totalTransactions: analytics.totalTransactions,
          totalVolume: analytics.totalVolume,
          averageAmount: analytics.averageAmount,
          successRate: analytics.successRate,
          failureRate: analytics.failureRate
        },
        breakdown: {
          byType: analytics.byType,
          byStatus: analytics.byStatus,
          byTimeInterval: analytics.byTimeInterval
        },
        trends: {
          volumeTrend: analytics.volumeTrend,
          countTrend: analytics.countTrend,
          averageAmountTrend: analytics.averageAmountTrend
        },
        topAddresses: analytics.topAddresses,
        recentAlerts: alerts.slice(-10)
      },
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to generate analytics: ${error.message}`
    };
  }
});

// Check transaction status
server.registerTool("check_transaction_status", {
  title: "Check Transaction Status",
  description: "Get detailed status and confirmation info for specific transactions",
  inputSchema: {
    transactionId: { type: "string", description: "Transaction ID to check" },
    transactionHash: { type: "string", description: "Bitcoin transaction hash" },
    includeMempool: { type: "boolean", description: "Include mempool information" }
  }
}, async (transactionId = null, transactionHash = null, includeMempool = false) => {
  try {
    let transaction = null;

    if (transactionId) {
      transaction = await getTransactionById(transactionId);
    } else if (transactionHash) {
      transaction = await getTransactionByHash(transactionHash);
    } else {
      return {
        success: false,
        error: "Either transactionId or transactionHash is required"
      };
    }

    if (!transaction) {
      return {
        success: false,
        error: "Transaction not found"
      };
    }

    // Get additional blockchain info if it's a Bitcoin transaction
    let blockchainInfo = null;
    if (transaction.hash && includeMempool) {
      blockchainInfo = await getBlockchainInfo(transaction.hash);
    }

    return {
      success: true,
      transaction: {
        id: transaction.id,
        hash: transaction.hash,
        amount: transaction.amount,
        status: transaction.status,
        confirmations: transaction.confirmations || 0,
        timestamp: transaction.timestamp,
        sender: transaction.sender,
        recipient: transaction.recipient,
        fees: transaction.fees,
        type: transaction.type,
        description: transaction.description
      },
      blockchainInfo,
      realTimeData: {
        checkedAt: new Date().toISOString(),
        estimatedConfirmationTime: calculateConfirmationTime(transaction),
        networkStatus: await getNetworkStatus()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to check transaction status: ${error.message}`
    };
  }
});

// Set up transaction alerts
server.registerTool("create_transaction_alert", {
  title: "Create Transaction Alert",
  description: "Set up custom alerts for specific transaction conditions",
  inputSchema: {
    alertId: { type: "string", description: "Unique alert identifier" },
    condition: {
      type: "object",
      properties: {
        type: { 
          type: "string", 
          enum: ["amount_threshold", "failed_transaction", "address_activity", "status_change"],
          description: "Alert condition type"
        },
        threshold: { type: "number", description: "Amount threshold for alerts" },
        addresses: { 
          type: "array", 
          items: { type: "string" },
          description: "Addresses to monitor"
        },
        statuses: {
          type: "array",
          items: { type: "string" },
          description: "Transaction statuses to alert on"
        }
      }
    },
    notification: {
      type: "object",
      properties: {
        webhook: { type: "string", description: "Webhook URL" },
        email: { type: "string", description: "Email address" },
        priority: { 
          type: "string", 
          enum: ["low", "medium", "high", "critical"],
          description: "Alert priority"
        }
      }
    }
  }
}, async (alertId, condition, notification) => {
  try {
    const alert = {
      id: alertId,
      condition,
      notification: {
        webhook: notification.webhook,
        email: notification.email,
        priority: notification.priority || "medium"
      },
      createdAt: new Date().toISOString(),
      isActive: true,
      triggerCount: 0,
      lastTriggered: null
    };

    // Store alert configuration
    activeMonitors.set(`alert_${alertId}`, alert);

    return {
      success: true,
      message: "Transaction alert created successfully",
      alert: {
        id: alertId,
        type: condition.type,
        priority: notification.priority,
        status: "active"
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to create alert: ${error.message}`
    };
  }
});

// Stop monitoring
server.registerTool("stop_monitoring", {
  title: "Stop Transaction Monitoring",
  description: "Stop active transaction monitoring session",
  inputSchema: {
    monitorId: { type: "string", description: "Monitor ID to stop" }
  }
}, async (monitorId) => {
  const monitor = activeMonitors.get(monitorId);
  if (!monitor) {
    return {
      success: false,
      error: "Monitor not found"
    };
  }

  monitor.isActive = false;
  monitor.endTime = new Date().toISOString();

  return {
    success: true,
    message: "Transaction monitoring stopped",
    summary: {
      monitorId,
      duration: calculateDuration(monitor.startTime, monitor.endTime),
      transactionsMonitored: monitor.transactionCount,
      alertsGenerated: alerts.filter(a => a.monitorId === monitorId).length
    }
  };
});

// Helper Functions

async function startTransactionPolling(monitorId) {
  const monitor = activeMonitors.get(monitorId);
  if (!monitor) return;

  const pollInterval = setInterval(async () => {
    if (!monitor.isActive) {
      clearInterval(pollInterval);
      return;
    }

    try {
      const newTransactions = await fetchRecentTransactions(20);
      
      for (const tx of newTransactions) {
        if (shouldProcessTransaction(tx, monitor)) {
          await processTransaction(tx, monitor);
          monitor.transactionCount++;
          monitor.lastActivity = new Date().toISOString();
        }
      }
    } catch (error) {
      console.error(`Polling error for monitor ${monitorId}:`, error);
    }
  }, 5000); // Poll every 5 seconds
}

function shouldProcessTransaction(transaction, monitor) {
  // Apply filters
  if (transaction.amount < monitor.filters.minAmount) return false;
  if (transaction.amount > monitor.filters.maxAmount) return false;
  
  if (monitor.filters.addresses.length > 0) {
    const hasMatchingAddress = monitor.filters.addresses.some(addr => 
      transaction.sender === addr || transaction.recipient === addr
    );
    if (!hasMatchingAddress) return false;
  }
  
  if (!monitor.filters.status.includes(transaction.status)) return false;
  
  return true;
}

async function processTransaction(transaction, monitor) {
  // Store transaction
  transactionHistory.push({
    ...transaction,
    monitorId: monitor.id,
    processedAt: new Date().toISOString()
  });

  // Check alert rules
  await checkAlertRules(transaction, monitor);

  // Emit real-time event
  transactionEvents.emit('transaction', {
    monitorId: monitor.id,
    transaction
  });
}

async function checkAlertRules(transaction, monitor) {
  const alertRules = monitor.alertRules;

  // Large transaction alert
  if (transaction.amount >= alertRules.largeTransaction) {
    await sendAlert(monitor.id, {
      type: 'large_transaction',
      transaction,
      message: `Large transaction detected: ${transaction.amount} BTC`
    });
  }

  // Failed transaction alert
  if (alertRules.failedTransaction && transaction.status === 'failed') {
    await sendAlert(monitor.id, {
      type: 'failed_transaction',
      transaction,
      message: `Transaction failed: ${transaction.id}`
    });
  }
}

async function sendAlert(monitorId, alertData) {
  const alert = {
    id: `alert_${Date.now()}`,
    monitorId,
    ...alertData,
    timestamp: new Date().toISOString()
  };

  alerts.push(alert);

  // Send webhook if configured
  const monitor = activeMonitors.get(monitorId);
  if (monitor?.alertRules.webhookUrl) {
    try {
      await axios.post(monitor.alertRules.webhookUrl, alert);
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  // Emit alert event
  transactionEvents.emit('alert', alert);
}

async function fetchRecentTransactions(limit) {
  // Mock implementation - replace with actual Bitnob API call
  const options = {
    method: 'GET',
    url: 'https://sandboxapi.bitnob.co/api/v1/wallets/transactions',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${config.API_KEY}`
    },
    params: { limit }
  };

  try {
    const response = await axios.request(options);
    return response.data.transactions || [];
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
  }
}

async function enrichTransactionData(transaction) {
  // Add real-time enrichment
  return {
    ...transaction,
    enriched: true,
    enrichedAt: new Date().toISOString(),
    estimatedConfirmationTime: calculateConfirmationTime(transaction),
    riskScore: calculateRiskScore(transaction)
  };
}

async function generateTransactionAnalytics(timeframe, groupBy) {
  // Mock analytics generation - implement with actual data
  return {
    totalTransactions: 150,
    totalVolume: 2.5,
    averageAmount: 0.0167,
    successRate: 0.94,
    failureRate: 0.06,
    byType: {
      bitcoin: 80,
      lightning: 60,
      virtual_card: 10
    },
    byStatus: {
      confirmed: 141,
      pending: 6,
      failed: 3
    },
    byTimeInterval: [],
    volumeTrend: 'increasing',
    countTrend: 'stable',
    averageAmountTrend: 'decreasing',
    topAddresses: []
  };
}

function calculateConfirmationTime(transaction) {
  if (transaction.type === 'lightning') return '< 1 minute';
  if (transaction.confirmations >= 6) return 'Confirmed';
  return `${10 - transaction.confirmations * 1.5} minutes (estimated)`;
}

function calculateRiskScore(transaction) {
  let score = 0;
  if (transaction.amount > 0.1) score += 30;
  if (transaction.confirmations < 3) score += 20;
  if (transaction.status === 'pending') score += 15;
  return Math.min(score, 100);
}

function calculateDuration(start, end) {
  const startTime = new Date(start);
  const endTime = new Date(end);
  const diffMs = endTime - startTime;
  return `${Math.round(diffMs / 1000 / 60)} minutes`;
}

async function getTransactionById(id) {
  // Mock implementation
  return {
    id,
    hash: 'mock_hash_' + id,
    amount: 0.001,
    status: 'confirmed',
    confirmations: 6,
    timestamp: new Date().toISOString()
  };
}

async function getTransactionByHash(hash) {
  // Mock implementation
  return {
    id: 'tx_' + hash.slice(-8),
    hash,
    amount: 0.001,
    status: 'confirmed',
    confirmations: 6,
    timestamp: new Date().toISOString()
  };
}

async function getBlockchainInfo(hash) {
  // Mock blockchain info
  return {
    blockHeight: 800000,
    blockTime: new Date().toISOString(),
    fees: 0.0001,
    size: 250
  };
}

async function getNetworkStatus() {
  return {
    blockHeight: 800000,
    difficulty: 50000000000000,
    hashRate: '150 EH/s',
    mempool: 2500
  };
}

// Start the MCP server
const transport = new StdioServerTransport();
await server.connect(transport);