/**
 * Automated Payment Workflows MCP Server
 * Handles complex payment automation for the decentralized network
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from 'axios';
import cron from 'node-cron';
import config from '../configs/config.js';

const server = new McpServer({
  name: "automated-payments",
  version: "1.0.0"
});

// In-memory workflow storage (use database in production)
const workflows = new Map();
const scheduledJobs = new Map();

// Create automated payment workflow
server.registerTool("create_payment_workflow", {
  title: "Create Payment Workflow",
  description: "Set up automated payment schedules for IPFS agents, storage billing, or custom workflows",
  inputSchema: {
    workflowId: { type: "string", description: "Unique workflow identifier" },
    type: { 
      type: "string", 
      enum: ["storage_billing", "agent_payment", "subscription", "custom"],
      description: "Type of payment workflow"
    },
    schedule: { 
      type: "string", 
      description: "Cron expression (e.g., '0 0 1 * *' for monthly)" 
    },
    recipients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          address: { type: "string", description: "Bitcoin address or email" },
          amount: { type: "number", description: "Amount in BTC" },
          description: { type: "string", description: "Payment description" }
        }
      }
    },
    conditions: {
      type: "object",
      properties: {
        minBalance: { type: "number", description: "Minimum wallet balance required" },
        maxAmount: { type: "number", description: "Maximum payment per execution" },
        enabled: { type: "boolean", description: "Workflow enabled status" }
      }
    }
  }
}, async (workflowId, type, schedule, recipients, conditions = {}) => {
  try {
    const workflow = {
      id: workflowId,
      type,
      schedule,
      recipients,
      conditions: {
        minBalance: conditions.minBalance || 0.001,
        maxAmount: conditions.maxAmount || 1.0,
        enabled: conditions.enabled !== false
      },
      createdAt: new Date().toISOString(),
      lastExecuted: null,
      totalExecutions: 0,
      totalAmountPaid: 0,
      status: 'active'
    };

    workflows.set(workflowId, workflow);

    // Schedule the workflow
    if (workflow.conditions.enabled) {
      const job = cron.schedule(schedule, async () => {
        await executeWorkflow(workflowId);
      }, { scheduled: false });
      
      scheduledJobs.set(workflowId, job);
      job.start();
    }

    return {
      success: true,
      message: "Automated payment workflow created successfully",
      workflow: {
        id: workflowId,
        type,
        schedule,
        recipientCount: recipients.length,
        status: workflow.status,
        nextExecution: getNextExecutionTime(schedule)
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to create workflow: ${error.message}`
    };
  }
});

// Execute payment workflow
server.registerTool("execute_workflow", {
  title: "Execute Payment Workflow",
  description: "Manually trigger a payment workflow execution",
  inputSchema: {
    workflowId: { type: "string", description: "Workflow ID to execute" },
    dryRun: { type: "boolean", description: "Test run without actual payments" }
  }
}, async (workflowId, dryRun = false) => {
  return await executeWorkflow(workflowId, dryRun);
});

// Get workflow status
server.registerTool("get_workflow_status", {
  title: "Get Workflow Status",
  description: "Check status and history of payment workflows",
  inputSchema: {
    workflowId: { type: "string", description: "Workflow ID (optional for all)" }
  }
}, async (workflowId = null) => {
  if (workflowId) {
    const workflow = workflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: "Workflow not found" };
    }
    
    return {
      success: true,
      workflow: {
        ...workflow,
        nextExecution: workflow.conditions.enabled ? getNextExecutionTime(workflow.schedule) : null,
        isRunning: scheduledJobs.has(workflowId)
      }
    };
  }

  // Return all workflows
  const allWorkflows = Array.from(workflows.values()).map(workflow => ({
    id: workflow.id,
    type: workflow.type,
    status: workflow.status,
    totalExecutions: workflow.totalExecutions,
    totalAmountPaid: workflow.totalAmountPaid,
    lastExecuted: workflow.lastExecuted,
    enabled: workflow.conditions.enabled
  }));

  return {
    success: true,
    workflows: allWorkflows,
    totalWorkflows: allWorkflows.length,
    activeWorkflows: allWorkflows.filter(w => w.status === 'active').length
  };
});

// Pause/Resume workflow
server.registerTool("toggle_workflow", {
  title: "Toggle Workflow",
  description: "Pause or resume automated payment workflow",
  inputSchema: {
    workflowId: { type: "string", description: "Workflow ID" },
    action: { 
      type: "string", 
      enum: ["pause", "resume", "delete"],
      description: "Action to perform"
    }
  }
}, async (workflowId, action) => {
  const workflow = workflows.get(workflowId);
  if (!workflow) {
    return { success: false, error: "Workflow not found" };
  }

  const job = scheduledJobs.get(workflowId);

  switch (action) {
    case 'pause':
      workflow.conditions.enabled = false;
      workflow.status = 'paused';
      if (job) {
        job.stop();
      }
      break;

    case 'resume':
      workflow.conditions.enabled = true;
      workflow.status = 'active';
      if (job) {
        job.start();
      }
      break;

    case 'delete':
      workflow.status = 'deleted';
      if (job) {
        job.destroy();
        scheduledJobs.delete(workflowId);
      }
      workflows.delete(workflowId);
      break;
  }

  return {
    success: true,
    message: `Workflow ${action}d successfully`,
    workflow: {
      id: workflowId,
      status: workflow.status,
      enabled: workflow.conditions?.enabled
    }
  };
});

// Bulk payment execution
server.registerTool("execute_bulk_payments", {
  title: "Execute Bulk Payments",
  description: "Send payments to multiple recipients in one operation",
  inputSchema: {
    payments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          address: { type: "string", description: "Recipient address" },
          amount: { type: "number", description: "Amount in BTC" },
          email: { type: "string", description: "Recipient email" },
          description: { type: "string", description: "Payment description" }
        }
      }
    },
    batchId: { type: "string", description: "Batch identifier" }
  }
}, async (payments, batchId) => {
  const results = [];
  let successCount = 0;
  let totalAmount = 0;

  for (const payment of payments) {
    try {
      const result = await sendBitcoinPayment(
        payment.address,
        payment.email,
        payment.amount,
        payment.description || `Batch payment ${batchId}`
      );

      results.push({
        address: payment.address,
        amount: payment.amount,
        success: true,
        transactionId: result.id,
        status: result.status
      });

      successCount++;
      totalAmount += payment.amount;
    } catch (error) {
      results.push({
        address: payment.address,
        amount: payment.amount,
        success: false,
        error: error.message
      });
    }
  }

  return {
    batchId,
    totalPayments: payments.length,
    successfulPayments: successCount,
    failedPayments: payments.length - successCount,
    totalAmount,
    results
  };
});

// Helper function to execute workflow
async function executeWorkflow(workflowId, dryRun = false) {
  const workflow = workflows.get(workflowId);
  if (!workflow) {
    return { success: false, error: "Workflow not found" };
  }

  if (!workflow.conditions.enabled && !dryRun) {
    return { success: false, error: "Workflow is disabled" };
  }

  // Check wallet balance
  const balance = await getWalletBalance();
  if (balance < workflow.conditions.minBalance) {
    return {
      success: false,
      error: `Insufficient balance. Required: ${workflow.conditions.minBalance}, Available: ${balance}`
    };
  }

  const results = [];
  let totalAmount = 0;

  for (const recipient of workflow.recipients) {
    if (totalAmount + recipient.amount > workflow.conditions.maxAmount) {
      results.push({
        address: recipient.address,
        amount: recipient.amount,
        success: false,
        error: "Would exceed maximum amount limit"
      });
      continue;
    }

    if (dryRun) {
      results.push({
        address: recipient.address,
        amount: recipient.amount,
        success: true,
        status: "DRY_RUN",
        note: "Payment would be sent"
      });
    } else {
      try {
        const result = await sendBitcoinPayment(
          recipient.address,
          recipient.email || 'automated@system.com',
          recipient.amount,
          recipient.description || `Automated payment: ${workflow.type}`
        );

        results.push({
          address: recipient.address,
          amount: recipient.amount,
          success: true,
          transactionId: result.id,
          status: result.status
        });

        totalAmount += recipient.amount;
      } catch (error) {
        results.push({
          address: recipient.address,
          amount: recipient.amount,
          success: false,
          error: error.message
        });
      }
    }
  }

  // Update workflow statistics
  if (!dryRun) {
    workflow.totalExecutions++;
    workflow.totalAmountPaid += totalAmount;
    workflow.lastExecuted = new Date().toISOString();
  }

  return {
    success: true,
    workflowId,
    executionTime: new Date().toISOString(),
    dryRun,
    totalPayments: workflow.recipients.length,
    successfulPayments: results.filter(r => r.success).length,
    totalAmount,
    results
  };
}

// Helper function to send Bitcoin payment
async function sendBitcoinPayment(address, email, btc, description) {
  const options = {
    method: 'POST',
    url: 'https://sandboxapi.bitnob.co/api/v1/wallets/send_bitcoin',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${config.API_KEY}`
    },
    data: {
      satoshis: btc * 100000000, // Convert BTC to satoshis
      address: address,
      customerEmail: email,
      description: description,
      priorityLevel: 'regular'
    }
  };

  const response = await axios.request(options);
  return response.data;
}

// Helper function to get wallet balance
async function getWalletBalance() {
  try {
    const options = {
      method: 'GET',
      url: 'https://sandboxapi.bitnob.co/api/v1/wallets/balance',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${config.API_KEY}`
      }
    };

    const response = await axios.request(options);
    return response.data.balance / 100000000; // Convert satoshis to BTC
  } catch (error) {
    console.error('Failed to get wallet balance:', error);
    return 0;
  }
}

// Helper function to get next execution time
function getNextExecutionTime(cronExpression) {
  // This is a simplified version - use a proper cron parser in production
  const now = new Date();
  // For demo purposes, assume next execution is in 1 hour for any cron
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
}

// Start the MCP server
const transport = new StdioServerTransport();
await server.connect(transport);