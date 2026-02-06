// API Keys Module Data Stores
// Feature #2084: PostgreSQL-backed via repository layer
// Feature #2113: Proxy Map exports REMOVED. Only async DB functions exported.

import {
  createApiKey as dbCreateApiKey,
  getApiKeyById as dbGetApiKeyById,
  getApiKeyByHash as dbGetApiKeyByHash,
  listApiKeysByOrg as dbListApiKeysByOrg,
  updateApiKey as dbUpdateApiKey,
  revokeApiKey as dbRevokeApiKey,
  createMcpConnection as dbCreateMcpConnection,
  getMcpConnection as dbGetMcpConnection,
  updateMcpConnectionActivity as dbUpdateMcpConnectionActivity,
  deleteMcpConnection as dbDeleteMcpConnection,
  cleanupStaleMcpConnections as dbCleanupStaleMcpConnections,
  createMcpToolCall as dbCreateMcpToolCall,
  getMcpToolCallsByOrg as dbGetMcpToolCallsByOrg,
  createMcpAuditLog as dbCreateMcpAuditLog,
  getMcpAuditLogs as dbGetMcpAuditLogs,
} from '../../services/repositories/api-keys';

// ===== ASYNC DATABASE FUNCTIONS =====
// All data access goes through these async functions

export {
  dbCreateApiKey,
  dbGetApiKeyById,
  dbGetApiKeyByHash,
  dbListApiKeysByOrg,
  dbUpdateApiKey,
  dbRevokeApiKey,
  dbCreateMcpConnection,
  dbGetMcpConnection,
  dbUpdateMcpConnectionActivity,
  dbDeleteMcpConnection,
  dbCleanupStaleMcpConnections,
  dbCreateMcpToolCall,
  dbGetMcpToolCallsByOrg,
  dbCreateMcpAuditLog,
  dbGetMcpAuditLogs,
};
