import cron from 'node-cron';
import { checkAndUpdateExpiredBills } from './billService';

class CronService {
  constructor() {
    this.jobs = new Map();
  }

  // create cron
  initExpiredBillsJob() {
    
    const cronExpression = '0 12 * * *'; // 12 PM every day 
    
    const job = cron.schedule(cronExpression, async () => {
      console.log('🕐 CRON JOB STARTED - Daily Expired Bills Check');
      console.log('📅 Time:', new Date().toLocaleString());
      
      try {
        const result = await checkAndUpdateExpiredBills();
        
        if (result.success) {
          console.log(`✅ CRON SUCCESS: Processed ${result.count || 0} expired bills`);
          
          // log database
          if (result.count > 0) {
            await this.logCronResult('expired_bills_check', result);
          }
        } else {
          console.error('❌ CRON FAILED:', result.msg);
        }
      } catch (error) {
        console.error('❌ CRON ERROR:', error);
      }
      
      console.log('🏁 CRON JOB COMPLETED');
    }, {
      scheduled: false, 
      timezone: "Asia/Ho_Chi_Minh" // Timezone VN
    });

    this.jobs.set('expiredBills', job);
    console.log('📋 Expired bills cron job created (not started)');
    
    return job;
  }

  // create cron
  initCleanupJob() {
    const cronExpression = '0 2 * * 0'; // 2 AM every Sunday
    
    const job = cron.schedule(cronExpression, async () => {
      console.log('🧹 CRON JOB STARTED - Weekly Database Cleanup');
      
      try {
        // Xóa các log cũ, bills cancelled cũ, etc.
        await this.performDatabaseCleanup();
        console.log('✅ CRON SUCCESS: Database cleanup completed');
      } catch (error) {
        console.error('❌ CRON ERROR in cleanup:', error);
      }
    }, {
      scheduled: false,
      timezone: "Asia/Ho_Chi_Minh"
    });

    this.jobs.set('cleanup', job);
    return job;
  }

  // Database cleanup logic
  async performDatabaseCleanup() {
    try {
      // 
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { error } = await supabase
        .from('bills')
        .delete()
        .eq('state', 'cancelled')
        .lt('created_at', thirtyDaysAgo.toISOString());
      
      if (error) {
        console.error('Error in cleanup:', error);
      } else {
        console.log('🗑️ Cleaned up old cancelled bills');
      }
    } catch (error) {
      console.error('Error in performDatabaseCleanup:', error);
    }
  }

  // Log cron
  async logCronResult(jobType, result) {
    try {
      const logData = {
        job_type: jobType,
        status: result.success ? 'success' : 'failed',
        count: result.count || 0,
        message: result.msg || 'Completed successfully',
        executed_at: new Date().toISOString()
      };
      
      console.log('📝 Logging cron result:', logData);
      
      // await supabase.from('cron_logs').insert([logData]);
      
    } catch (error) {
      console.error('Error logging cron result:', error);
    }
  }

  // Start all
  startAll() {
    console.log('🚀 Starting all cron jobs...');
    
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`✅ Started cron job: ${name}`);
    });
    
    this.printSchedule();
  }

  // Stop all
  stopAll() {
    console.log('🛑 Stopping all cron jobs...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`❌ Stopped cron job: ${name}`);
    });
  }

  // Start 
  start(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      console.log(`✅ Started cron job: ${jobName}`);
    } else {
      console.log(`❌ Cron job not found: ${jobName}`);
    }
  }

  // stop
  stop(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      console.log(`❌ Stopped cron job: ${jobName}`);
    }
  }

  // test
  async runNow(jobName) {
    console.log(`⚡ Running cron job immediately: ${jobName}`);
    
    if (jobName === 'expiredBills') {
      await checkAndUpdateExpiredBills();
    } else if (jobName === 'cleanup') {
      await this.performDatabaseCleanup();
    }
  }

  // schedule
  printSchedule() {
    console.log('📅 CRON SCHEDULE:');
    console.log('- Expired Bills Check: Daily at 12:00 PM (Vietnam time)');
    console.log('- Database Cleanup: Weekly on Sunday at 2:00 AM');
  }

  // Get status của jobs
  getStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running || false,
        destroyed: job.destroyed || false
      };
    });
    return status;
  }
}

// Export singleton instance
export const cronService = new CronService();

// Initialize jobs
cronService.initExpiredBillsJob();
cronService.initCleanupJob();