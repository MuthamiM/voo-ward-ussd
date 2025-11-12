const { encryptSensitive, decryptSensitive, hashForSearch, anonymizePhone, anonymizeId, logSecurityEvent } = require('./crypto');

class PrivacyProtection {
  constructor() {
    // Data retention policies (in days)
    this.retentionPolicies = {
      audit_logs: 730,        // 2 years
      constituents: 2555,     // 7 years (legal requirement)
      issues: 1095,           // 3 years
      bursary_applications: 2555, // 7 years
      sessions: 1,            // 1 day
      failed_attempts: 30     // 30 days
    };
  }

  // Encrypt PII before storing in database
  encryptPII(data) {
    const sensitiveFields = ['full_name', 'location', 'village', 'description'];
    const encrypted = { ...data };
    
    for (const field of sensitiveFields) {
      if (data[field]) {
        encrypted[field] = encryptSensitive(data[field]);
        encrypted[`${field}_search_hash`] = hashForSearch(data[field]);
      }
    }
    
    return encrypted;
  }

  // Decrypt PII when retrieving from database
  decryptPII(data) {
    if (!data) return data;
    
    const sensitiveFields = ['full_name', 'location', 'village', 'description'];
    const decrypted = { ...data };
    
    for (const field of sensitiveFields) {
      if (data[field] && typeof data[field] === 'object') {
        decrypted[field] = decryptSensitive(data[field]);
        delete decrypted[`${field}_search_hash`]; // Remove search hashes from output
      }
    }
    
    return decrypted;
  }

  // Anonymize data for analytics/reporting
  anonymizeForAnalytics(data) {
    if (!data) return data;
    
    const anonymized = { ...data };
    
    // Remove direct identifiers
    delete anonymized.full_name;
    delete anonymized.national_id;
    delete anonymized.phone_number;
    
    // Keep only necessary fields for analytics
    const analyticsFields = [
      'id', 'created_at', 'verification_status', 'location', 
      'issue_category', 'status', 'resolved_at'
    ];
    
    const result = {};
    for (const field of analyticsFields) {
      if (anonymized[field] !== undefined) {
        result[field] = anonymized[field];
      }
    }
    
    // Add anonymized identifiers if needed
    if (data.phone_number) {
      result.phone_hash = anonymizePhone(data.phone_number);
    }
    
    return result;
  }

  // Implement data subject rights (GDPR/Kenya DPA compliance)
  async handleDataSubjectRequest(client, requestType, phoneNumber) {
    const phoneHash = require('./crypto').hashPhone(phoneNumber);
    
    logSecurityEvent('DATA_SUBJECT_REQUEST', {
      requestType,
      phone: anonymizePhone(phoneNumber),
      severity: 'INFO'
    });
    
    switch (requestType) {
      case 'ACCESS':
        return await this.exportPersonalData(client, phoneHash);
        
      case 'RECTIFICATION':
        // Allow user to update their information
        return await this.prepareDataForRectification(client, phoneHash);
        
      case 'ERASURE':
        return await this.erasePersonalData(client, phoneHash);
        
      case 'PORTABILITY':
        return await this.exportDataForPortability(client, phoneHash);
        
      default:
        throw new Error('Invalid data subject request type');
    }
  }

  // Export all personal data for a citizen
  async exportPersonalData(client, phoneHash) {
    const personalData = {
      exported_at: new Date().toISOString(),
      data_controller: 'Kyamatu Ward, Kitui County',
      legal_basis: 'Public interest (governance and citizen services)'
    };

    try {
      // Get constituent information
      const constituent = await client.query(
        'SELECT * FROM constituents WHERE phone_hash = $1',
        [phoneHash]
      );
      
      if (constituent.rows.length > 0) {
        personalData.personal_info = this.decryptPII(constituent.rows[0]);
        delete personalData.personal_info.phone_hash; // Remove internal hash
      }

      // Get all issues reported
      const issues = await client.query(
        'SELECT * FROM issues WHERE phone_hash = $1 ORDER BY created_at DESC',
        [phoneHash]
      );
      
      personalData.issues = issues.rows.map(issue => this.decryptPII(issue));

      // Get bursary applications
      const bursaries = await client.query(
        'SELECT * FROM bursary_applications WHERE phone_hash = $1 ORDER BY created_at DESC',
        [phoneHash]
      );
      
      personalData.bursary_applications = bursaries.rows.map(app => this.decryptPII(app));

      // Get audit logs related to this user
      const auditLogs = await client.query(`
        SELECT timestamp, action, entity, details 
        FROM audit_log 
        WHERE details::text LIKE $1 
        ORDER BY timestamp DESC 
        LIMIT 100
      `, [`%${phoneHash}%`]);
      
      personalData.activity_log = auditLogs.rows;

      return personalData;

    } catch (error) {
      logSecurityEvent('DATA_EXPORT_ERROR', {
        error: error.message,
        severity: 'HIGH'
      });
      throw error;
    }
  }

  // Prepare data for rectification (updating)
  async prepareDataForRectification(client, phoneHash) {
    const constituent = await client.query(
      'SELECT id, full_name, location, village FROM constituents WHERE phone_hash = $1',
      [phoneHash]
    );
    
    if (constituent.rows.length === 0) {
      throw new Error('No data found for rectification');
    }

    const currentData = this.decryptPII(constituent.rows[0]);
    
    return {
      current_data: currentData,
      rectifiable_fields: ['full_name', 'location', 'village'],
      instructions: 'Contact MCA office to update your information'
    };
  }

  // Erase personal data (right to be forgotten)
  async erasePersonalData(client, phoneHash) {
    const erasureLog = {
      timestamp: new Date().toISOString(),
      phone_hash: phoneHash,
      tables_affected: []
    };

    try {
      await client.query('BEGIN');

      // Mark constituent as erased (keep for legal compliance but anonymize)
      const result1 = await client.query(`
        UPDATE constituents 
        SET 
          full_name = 'ERASED',
          location = 'ERASED',
          village = 'ERASED',
          verification_status = 'erased',
          erased_at = NOW()
        WHERE phone_hash = $1
      `, [phoneHash]);
      
      if (result1.rowCount > 0) {
        erasureLog.tables_affected.push('constituents');
      }

      // Anonymize issues but keep for statistical purposes
      const result2 = await client.query(`
        UPDATE issues 
        SET 
          description = 'ERASED - Data subject request',
          updated_at = NOW()
        WHERE phone_hash = $1
      `, [phoneHash]);
      
      if (result2.rowCount > 0) {
        erasureLog.tables_affected.push('issues');
      }

      // Erase bursary applications completely (if legally allowed)
      const result3 = await client.query(`
        DELETE FROM bursary_applications 
        WHERE phone_hash = $1 AND created_at < NOW() - INTERVAL '7 years'
      `, [phoneHash]);
      
      if (result3.rowCount > 0) {
        erasureLog.tables_affected.push('bursary_applications');
      }

      // Log the erasure action
      await client.query(`
        INSERT INTO audit_log (entity, action, actor, details)
        VALUES ('privacy', 'DATA_ERASURE', 'system', $1)
      `, [JSON.stringify(erasureLog)]);

      await client.query('COMMIT');

      logSecurityEvent('DATA_ERASURE_COMPLETED', {
        tables_affected: erasureLog.tables_affected,
        severity: 'INFO'
      });

      return {
        status: 'completed',
        erased_at: erasureLog.timestamp,
        tables_affected: erasureLog.tables_affected,
        note: 'Some data may be retained for legal compliance purposes'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      
      logSecurityEvent('DATA_ERASURE_ERROR', {
        error: error.message,
        severity: 'HIGH'
      });
      
      throw error;
    }
  }

  // Export data in portable format
  async exportDataForPortability(client, phoneHash) {
    const personalData = await this.exportPersonalData(client, phoneHash);
    
    // Convert to structured format for portability
    const portableData = {
      format: 'JSON',
      version: '1.0',
      exported_at: new Date().toISOString(),
      data: personalData
    };

    return portableData;
  }

  // Clean up old data based on retention policies
  async cleanupOldData(client) {
    const cleanupLog = {
      timestamp: new Date().toISOString(),
      tables_cleaned: []
    };

    try {
      await client.query('BEGIN');

      // Clean up old audit logs
      const auditResult = await client.query(`
        DELETE FROM audit_log 
        WHERE created_at < NOW() - INTERVAL '${this.retentionPolicies.audit_logs} days'
      `);
      
      if (auditResult.rowCount > 0) {
        cleanupLog.tables_cleaned.push({
          table: 'audit_log',
          records_deleted: auditResult.rowCount
        });
      }

      // Clean up old resolved issues
      const issuesResult = await client.query(`
        DELETE FROM issues 
        WHERE status = 'resolved' 
        AND resolved_at < NOW() - INTERVAL '${this.retentionPolicies.issues} days'
      `);
      
      if (issuesResult.rowCount > 0) {
        cleanupLog.tables_cleaned.push({
          table: 'issues',
          records_deleted: issuesResult.rowCount
        });
      }

      // Log cleanup action
      await client.query(`
        INSERT INTO audit_log (entity, action, actor, details)
        VALUES ('privacy', 'DATA_CLEANUP', 'system', $1)
      `, [JSON.stringify(cleanupLog)]);

      await client.query('COMMIT');

      logSecurityEvent('DATA_CLEANUP_COMPLETED', {
        tables_cleaned: cleanupLog.tables_cleaned,
        severity: 'INFO'
      });

      return cleanupLog;

    } catch (error) {
      await client.query('ROLLBACK');
      
      logSecurityEvent('DATA_CLEANUP_ERROR', {
        error: error.message,
        severity: 'HIGH'
      });
      
      throw error;
    }
  }

  // Generate privacy compliance report
  async generateComplianceReport(client) {
    const report = {
      generated_at: new Date().toISOString(),
      data_controller: 'Kyamatu Ward, Kitui County',
      legal_framework: 'Kenya Data Protection Act 2019'
    };

    try {
      // Count records by type
      const constituentCount = await client.query('SELECT COUNT(*) FROM constituents');
      const issueCount = await client.query('SELECT COUNT(*) FROM issues');
      const bursaryCount = await client.query('SELECT COUNT(*) FROM bursary_applications');
      const auditCount = await client.query('SELECT COUNT(*) FROM audit_log');

      report.data_inventory = {
        constituents: parseInt(constituentCount.rows[0].count),
        issues: parseInt(issueCount.rows[0].count),
        bursary_applications: parseInt(bursaryCount.rows[0].count),
        audit_records: parseInt(auditCount.rows[0].count)
      };

      // Check for data older than retention periods
      const oldDataQuery = await client.query(`
        SELECT 
          'constituents' as table_name,
          COUNT(*) as old_records
        FROM constituents 
        WHERE created_at < NOW() - INTERVAL '${this.retentionPolicies.constituents} days'
        
        UNION ALL
        
        SELECT 
          'issues' as table_name,
          COUNT(*) as old_records
        FROM issues 
        WHERE created_at < NOW() - INTERVAL '${this.retentionPolicies.issues} days'
      `);

      report.retention_compliance = oldDataQuery.rows;

      // Count erased records
      const erasedCount = await client.query(`
        SELECT COUNT(*) FROM constituents WHERE verification_status = 'erased'
      `);
      
      report.erasure_requests = {
        total_erased: parseInt(erasedCount.rows[0].count)
      };

      return report;

    } catch (error) {
      logSecurityEvent('COMPLIANCE_REPORT_ERROR', {
        error: error.message,
        severity: 'HIGH'
      });
      
      throw error;
    }
  }
}

module.exports = PrivacyProtection;