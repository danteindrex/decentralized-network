import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  Activity, 
  Database, 
  Users, 
  Zap, 
  TrendingUp, 
  Clock,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react';
import { mcpService } from '../services/mcpService';
import { NetworkStats } from '../services/aiService';
import { formatAddress, formatDateTime, formatFileSize } from '../lib/utils';

interface DashboardProps {
  className?: string;
}

export function Dashboard({ className }: DashboardProps) {
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const aiService = mcpService.getAIService();
        if (!aiService) {
          throw new Error('AI service not available');
        }

        const stats = await aiService.getNetworkStats();
        setNetworkStats(stats);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch network stats:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLastUpdate(new Date());
    // Trigger useEffect to refresh data
    const event = new CustomEvent('dashboard-refresh');
    window.dispatchEvent(event);
  };

  if (isLoading && !networkStats) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading network statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !networkStats) {
    return (
      <div className={`p-6 ${className}`}>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to Load Dashboard</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tensor Parallelism Dashboard</h1>
          <p className="text-gray-600">
            Monitor your decentralized tensor parallelism network - free AI for everyone! 🆓
          </p>
        </div>
        <div className="text-right">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {formatDateTime(lastUpdate)}
          </p>
        </div>
      </div>

      {/* Network Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Blockchain Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-medium">
              <Database className="w-4 h-4 mr-2" />
              Blockchain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {networkStats?.blockNumber || 0}
                </span>
                {(networkStats?.blockNumber || 0) > 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <p className="text-xs text-gray-600">Current Block</p>
              <div className="flex items-center text-xs">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  (networkStats?.blockNumber || 0) > 0 ? 'bg-green-500' : 'bg-red-500'
                }`} />
                {(networkStats?.blockNumber || 0) > 0 ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* IPFS Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-medium">
              <Database className="w-4 h-4 mr-2" />
              IPFS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {networkStats?.ipfsStatus ? 'Online' : 'Offline'}
                </span>
                {networkStats?.ipfsStatus ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <p className="text-xs text-gray-600">Storage Network</p>
              <div className="flex items-center text-xs">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  networkStats?.ipfsStatus ? 'bg-green-500' : 'bg-red-500'
                }`} />
                {networkStats?.ipfsStatus ? 'Operational' : 'Unavailable'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tensor Devices */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-medium">
              <Users className="w-4 h-4 mr-2" />
              Tensor Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {networkStats?.connectedWorkers || 0}
                </span>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-xs text-gray-600">Phones, Laptops, Servers</p>
              <div className="text-xs text-green-600">
                📱 Mobile-first tensor processing
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Free Inference Jobs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-medium">
              <Zap className="w-4 h-4 mr-2" />
              Free Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {networkStats?.totalJobs || 0}
                </span>
                <Activity className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-xs text-gray-600">Total Processed</p>
              <div className="text-xs text-green-600">
                🆓 All inference completely FREE!
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Account Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">
                  {parseFloat(networkStats?.balance || '0').toFixed(4)} ETH
                </p>
                <p className="text-sm text-gray-600">
                  Available for inference payments
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  ≈ ${(parseFloat(networkStats?.balance || '0') * 2500).toFixed(2)} USD
                </p>
                <p className="text-xs text-gray-500">
                  Estimated at current rates
                </p>
              </div>
            </div>
            
            {/* Balance warning */}
            {parseFloat(networkStats?.balance || '0') < 0.01 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2" />
                  <p className="text-sm text-yellow-800">
                    Low balance. Consider adding ETH for inference requests.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col">
              <Zap className="w-6 h-6 mb-2" />
              <span className="text-sm">Run Inference</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <Database className="w-6 h-6 mb-2" />
              <span className="text-sm">View Storage</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <Clock className="w-6 h-6 mb-2" />
              <span className="text-sm">Job History</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <TrendingUp className="w-6 h-6 mb-2" />
              <span className="text-sm">Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Network Health */}
      <Card>
        <CardHeader>
          <CardTitle>Network Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Health</span>
                <span>85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700">Response Time</p>
                <p className="text-2xl font-bold text-green-600">12.3s</p>
                <p className="text-xs text-gray-500">Average</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">98.5%</p>
                <p className="text-xs text-gray-500">Last 24h</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
