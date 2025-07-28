import { createInvoice } from '../controllers/payController.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Invoice Scheduler Utility
 * Tracks customer transaction times and automatically generates invoices after specified periods
 */
class InvoiceScheduler {
    constructor() {
        this.customers = new Map();
        this.timers = new Map();
        this.dataFile = path.join(process.cwd(), 'data', 'customer_tracking.json');
        this.defaultBillingPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        
        // Load existing customer data on initialization
        this.loadCustomerData();
    }

    /**
     * Load customer tracking data from persistent storage
     */
    async loadCustomerData() {
        try {
            await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
            const data = await fs.readFile(this.dataFile, 'utf8');
            const customerData = JSON.parse(data);
            
            // Restore customer data and set up timers
            for (const [email, info] of Object.entries(customerData)) {
                this.customers.set(email, {
                    ...info,
                    firstTransactionTime: new Date(info.firstTransactionTime),
                    lastTransactionTime: new Date(info.lastTransactionTime),
                    nextBillingDate: new Date(info.nextBillingDate)
                });
                
                // Set up timer for existing customers
                this.setupBillingTimer(email);
            }
            
            console.log(`Loaded ${this.customers.size} customers from storage`);
        } catch (error) {
            console.log('No existing customer data found, starting fresh');
            this.customers = new Map();
        }
    }

    /**
     * Save customer tracking data to persistent storage
     */
    async saveCustomerData() {
        try {
            const customerData = {};
            for (const [email, info] of this.customers.entries()) {
                customerData[email] = {
                    ...info,
                    firstTransactionTime: info.firstTransactionTime.toISOString(),
                    lastTransactionTime: info.lastTransactionTime.toISOString(),
                    nextBillingDate: info.nextBillingDate.toISOString()
                };
            }
            
            await fs.writeFile(this.dataFile, JSON.stringify(customerData, null, 2));
        } catch (error) {
            console.error('Error saving customer data:', error);
        }
    }

    /**
     * Track a new transaction for a customer
     * @param {string} email - Customer email
     * @param {number} amount - Transaction amount in BTC
     * @param {string} transactionId - Unique transaction identifier
     * @param {number} billingPeriodDays - Custom billing period in days (optional)
     */
    async trackTransaction(email, amount, transactionId, billingPeriodDays = 30) {
        const now = new Date();
        const billingPeriod = billingPeriodDays * 24 * 60 * 60 * 1000;

        if (this.customers.has(email)) {
            // Update existing customer
            const customer = this.customers.get(email);
            customer.lastTransactionTime = now;
            customer.totalAmount += amount;
            customer.transactionCount += 1;
            customer.transactions.push({
                id: transactionId,
                amount: amount,
                timestamp: now
            });
            
            console.log(`Updated customer ${email}: Total amount: ${customer.totalAmount} BTC, Transactions: ${customer.transactionCount}`);
        } else {
            // New customer
            const nextBillingDate = new Date(now.getTime() + billingPeriod);
            
            const customerInfo = {
                email: email,
                firstTransactionTime: now,
                lastTransactionTime: now,
                nextBillingDate: nextBillingDate,
                totalAmount: amount,
                transactionCount: 1,
                billingPeriod: billingPeriod,
                transactions: [{
                    id: transactionId,
                    amount: amount,
                    timestamp: now
                }],
                invoicesGenerated: 0
            };
            
            this.customers.set(email, customerInfo);
            this.setupBillingTimer(email);
            
            console.log(`New customer tracked: ${email}, Next billing: ${nextBillingDate.toISOString()}`);
        }

        await this.saveCustomerData();
    }

    /**
     * Set up a timer for automatic invoice generation
     * @param {string} email - Customer email
     */
    setupBillingTimer(email) {
        const customer = this.customers.get(email);
        if (!customer) return;

        // Clear existing timer if any
        if (this.timers.has(email)) {
            clearTimeout(this.timers.get(email));
        }

        const now = new Date();
        const timeUntilBilling = customer.nextBillingDate.getTime() - now.getTime();

        if (timeUntilBilling <= 0) {
            // Billing is overdue, generate invoice immediately
            this.generateInvoiceForCustomer(email);
        } else {
            // Set timer for future billing
            const timer = setTimeout(() => {
                this.generateInvoiceForCustomer(email);
            }, timeUntilBilling);

            this.timers.set(email, timer);
            
            console.log(`Timer set for ${email}: ${Math.round(timeUntilBilling / (1000 * 60 * 60 * 24))} days remaining`);
        }
    }

    /**
     * Generate invoice for a specific customer
     * @param {string} email - Customer email
     */
    async generateInvoiceForCustomer(email) {
        const customer = this.customers.get(email);
        if (!customer) {
            console.error(`Customer ${email} not found`);
            return;
        }

        try {
            console.log(`Generating invoice for ${email}...`);
            
            // Calculate billing amount based on usage/storage
            const billingAmount = this.calculateBillingAmount(customer);
            
            // Generate invoice using the existing createInvoice function
            const invoice = await createInvoice({
                email: customer.email,
                btc: billingAmount
            });

            // Update customer record
            customer.invoicesGenerated += 1;
            customer.nextBillingDate = new Date(Date.now() + customer.billingPeriod);
            customer.totalAmount = 0; // Reset for next billing period
            customer.transactionCount = 0;
            customer.transactions = []; // Clear transactions for next period

            // Set up next billing timer
            this.setupBillingTimer(email);
            
            await this.saveCustomerData();

            console.log(`Invoice generated for ${email}: ${billingAmount} BTC`);
            
            // Emit event for frontend notification
            this.notifyFrontend(email, invoice, billingAmount);
            
            return invoice;
        } catch (error) {
            console.error(`Error generating invoice for ${email}:`, error);
        }
    }

    /**
     * Calculate billing amount based on customer usage
     * @param {Object} customer - Customer object
     * @returns {number} - Billing amount in BTC
     */
    calculateBillingAmount(customer) {
        // Base storage fee
        const baseStorageFee = 0.001; // 0.001 BTC base fee
        
        // Additional fee based on transaction volume
        const transactionFee = customer.transactionCount * 0.0001; // 0.0001 BTC per transaction
        
        // Additional fee based on total amount transacted
        const volumeFee = customer.totalAmount * 0.01; // 1% of total volume
        
        return baseStorageFee + transactionFee + volumeFee;
    }

    /**
     * Notify frontend about invoice generation
     * @param {string} email - Customer email
     * @param {Object} invoice - Generated invoice
     * @param {number} amount - Billing amount
     */
    notifyFrontend(email, invoice, amount) {
        // This would typically emit to a WebSocket or event system
        // For now, we'll log the notification
        console.log(`FRONTEND_NOTIFICATION: Invoice ready for ${email}`, {
            email,
            amount,
            invoice,
            timestamp: new Date().toISOString()
        });
        
        // You can extend this to integrate with your frontend notification system
        // Example: websocket.emit('invoice_generated', { email, invoice, amount });
    }

    /**
     * Get customer information
     * @param {string} email - Customer email
     * @returns {Object|null} - Customer information or null if not found
     */
    getCustomerInfo(email) {
        return this.customers.get(email) || null;
    }

    /**
     * Get all customers
     * @returns {Array} - Array of all customer information
     */
    getAllCustomers() {
        return Array.from(this.customers.entries()).map(([email, info]) => ({
            email,
            ...info
        }));
    }

    /**
     * Manually trigger invoice generation for a customer
     * @param {string} email - Customer email
     */
    async manualInvoiceGeneration(email) {
        await this.generateInvoiceForCustomer(email);
    }

    /**
     * Update billing period for a customer
     * @param {string} email - Customer email
     * @param {number} days - New billing period in days
     */
    async updateBillingPeriod(email, days) {
        const customer = this.customers.get(email);
        if (!customer) {
            console.error(`Customer ${email} not found`);
            return;
        }

        customer.billingPeriod = days * 24 * 60 * 60 * 1000;
        customer.nextBillingDate = new Date(customer.firstTransactionTime.getTime() + customer.billingPeriod);
        
        this.setupBillingTimer(email);
        await this.saveCustomerData();
        
        console.log(`Updated billing period for ${email} to ${days} days`);
    }

    /**
     * Remove a customer from tracking
     * @param {string} email - Customer email
     */
    async removeCustomer(email) {
        if (this.timers.has(email)) {
            clearTimeout(this.timers.get(email));
            this.timers.delete(email);
        }
        
        this.customers.delete(email);
        await this.saveCustomerData();
        
        console.log(`Removed customer ${email} from tracking`);
    }

    /**
     * Get time remaining until next billing for a customer
     * @param {string} email - Customer email
     * @returns {Object|null} - Time remaining information
     */
    getTimeUntilBilling(email) {
        const customer = this.customers.get(email);
        if (!customer) return null;

        const now = new Date();
        const timeRemaining = customer.nextBillingDate.getTime() - now.getTime();
        
        if (timeRemaining <= 0) {
            return { overdue: true, days: 0, hours: 0, minutes: 0 };
        }

        const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

        return { overdue: false, days, hours, minutes };
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        
        // Save final state
        await this.saveCustomerData();
        
        console.log('Invoice scheduler shutdown complete');
    }
}

// Create and export singleton instance
const invoiceScheduler = new InvoiceScheduler();

export default invoiceScheduler;

// Export the class for testing purposes
export { InvoiceScheduler };