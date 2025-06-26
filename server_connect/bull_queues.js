// JavaScript Document
// Orignal code by: Ken Truesdale
// Modified verison maintained by: Roney Dsilva

const { toSystemPath } = require('../../../lib/core/path');
const Queue = require('bull');
const config = require('../../../lib/setup/config');
const bullLogging = require('./bull_logging.js');

var console_logging = 'error';
var file_logging = 'none';
var bullLog = false;
var opensearch_logging = false;
var bq_logger = bullLogging.setupWinston(console_logging, file_logging, "BullQueue");

const defaultConcurrency = 5;
var redisReady = false;

if (process.env.REDIS_HOST || typeof global.redisClient !== 'undefined') {
    redisReady = true;
}
const defaultQueueOptions = {
    redis: {
        port: process.env.REDIS_PORT ||
            (global.redisClient ?
                (global.redisClient.options.port ?
                    global.redisClient.options.port :
                    global.redisClient.options.socket.port) : {}),
        host: process.env.REDIS_HOST ||
            (global.redisClient ?
                (global.redisClient.options.host ?
                    global.redisClient.options.host :
                    global.redisClient.options.socket.host) : {}),
        db: process.env.REDIS_BULL_QUEUE_DB || 2,
        ...(process.env.REDIS_PASSWORD || global.redisClient ? global.redisClient.options.password ? { password: process.env.REDIS_PASSWORD || global.redisClient.options.password } : {} : {}),
        ...(process.env.REDIS_USER || global.redisClient ? global.redisClient.options.user ? { username: process.env.REDIS_USER || global.redisClient.options.user } : {} : {}),
        ...(process.env.REDIS_TLS || global.redisClient ? global.redisClient.options.tls ? { tls: {} } : {} : {}),
        ...(process.env.REDIS_PREFIX ? { prefix: `{${process.env.REDIS_PREFIX}}` } : {}),
        ...(process.env.REDIS_BULL_METRICS ? {
            metrics: {
                maxDataPoints: process.env.REDIS_BULL_METRICS_TIME ?
                    Queue.utils.MetricsTime[process.env.REDIS_BULL_METRICS_TIME] : Queue.utils.MetricsTime.TWO_WEEKS,
            },
        } : {}),
    }
};

var bullQueues = [];
var workerCounts = [];
var processorTypes = [];

var responseMessages = {};
responseMessages['noredis'] = { "response": 'No Redis connection.' };
responseMessages['noqueue'] = { "response": 'Queue does not exist.' };



function setupQueue(queueName) {
    if (!bullQueues[queueName]) {
        var queueOptions = defaultQueueOptions;
        bullQueues[queueName] = new Queue(queueName, queueOptions);

    };
}

exports.bq_logging = async function(options) {

    console_logging = this.parseOptional(options.console_logging, 'string', 'error');
    file_logging = this.parseOptional(options.file_logging, 'string', 'none');
    bullLog = this.parseOptional(options.bull_logging, 'boolean', false);
    opensearch_logging = this.parseOptional(options.opensearch_logging, 'boolean', false);
    bq_logger = bullLogging.setupWinston(console_logging, file_logging, "BullQ", opensearch_logging);
    bq_logger.info('Logging configuration updated');
    return { "response": 'Logging configuration updated' }
}

exports.create_queue = async function(options) {


    bq_logger.debug('Create queue start');

    if (redisReady) {


        bq_logger.debug('Redis ready');
        bq_logger.debug('Options: ' + JSON.stringify(options));

        let processor_type = this.parseOptional(options.processor_type, 'string', 'library');
        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');
        let queueOptions = defaultQueueOptions;

        bq_logger.debug('RedisOptions: ' + JSON.stringify(defaultQueueOptions));

        let concurrent_jobs = defaultConcurrency;

        bq_logger.debug('Concurrent jobs: ' + concurrent_jobs);

        let processorPath = toSystemPath('/extensions/server_connect/modules/bull_processor.js');



        let limit_type = this.parseOptional(options.limit_type, '*', 'concurrency');

        bq_logger.debug('limit_type: ' + limit_type);
        bq_logger.debug('Options: ' + JSON.stringify(options));


        if (processor_type == 'api') {
            bq_logger.debug('If processor type api ');
            processorPath = toSystemPath('/extensions/server_connect/modules/bull_processor_api.js');
        }
        bq_logger.debug('processorPath: ' + processorPath);
        if (limit_type == 'limiter') {
            bq_logger.debug('If limit type limiter ');
            let max_jobs = parseInt(this.parseOptional(options.max_jobs, '*', null));
            bq_logger.debug('max_jobs: ' + max_jobs);
            let max_duration = parseInt(this.parseOptional(options.max_duration, '*', null));
            bq_logger.debug('max_duration: ' + max_duration);

            if (max_duration && max_jobs) {

                queueOptions = {
                    ...queueOptions,
                    limiter: {
                        max: max_jobs,
                        duration: max_duration
                    }
                }
                bq_logger.debug('Queue options ' + JSON.stringify(queueOptions));
            };
        }

        concurrent_jobs = parseInt(this.parseOptional(options.concurrent_jobs, '*', defaultConcurrency));
        bq_logger.debug('concurrent_jobs: ' + concurrent_jobs);

        if (!concurrent_jobs > 0) {
            bq_logger.debug('If !concurrent_jobs > 0')
            concurrent_jobs = defaultConcurrency;
        }

        if (!workerCounts[queueName]) {
            bq_logger.debug('Queue worker does not exist');
            if (bullQueues[queueName]) {
                bq_logger.debug('Bull queue exists, so closing');
                await bullQueues[queueName].close().catch(console.error);
                bullQueues[queueName] = null;
            }
            bq_logger.debug('Create bull queue named: ' + queueName);
            bullQueues[queueName] = new Queue(queueName, queueOptions);

            processorTypes[queueName] = processor_type;
            workerCounts[queueName] = concurrent_jobs;

            bq_logger.debug('attach workers')
            bullQueues[queueName].process(concurrent_jobs, processorPath);

            bq_logger.debug('get jobscount for ' + queueName);
            let jobscount = await bullQueues[queueName].getJobCounts().catch(console.error);

            bq_logger.debug('return response with jobscount');
            if (jobscount) {
                bq_logger.info('Queue ' + queueName + ' created');
                bq_logger.debug('Create queue finish');
                return { "response": 'Queue ' + queueName + ' created' };
            } else {
                bq_logger.info(queueName + ' NOT created');
                bq_logger.debug('Create queue finish');
                return {
                    "response": 'Queue ' + queueName + ' NOT created'
                };
            }
        } else {
            bq_logger.info('Queue ' + queueName + ' NOT created -- it already exists.');
            bq_logger.debug('Create queue finish');
            return { "response": 'Queue ' + queueName + ' NOT created -- it already exists.' };
        }

    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Create queue finish');
        return responseMessages.noredis;
    }


};

exports.destroy_queue = async function(options) {

    bq_logger.debug('Destroy queue start');

    if (redisReady) {
        bq_logger.debug('Redis ready');
        bq_logger.debug('Options: ' + JSON.stringify(options));

        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');

        if (!bullQueues[queueName]) {
            bq_logger.debug('Queue object does not exist, so create it');
            let queueOptions = defaultQueueOptions;
            bullQueues[queueName] = new Queue(queueName, queueOptions);

        };
        bq_logger.debug('Obliterate the bull queue, and close');
        await bullQueues[queueName].obliterate({ force: true });
        await bullQueues[queueName].close().catch(console.error);

        bq_logger.debug('Cleanup objects');
        bullQueues[queueName] = null;
        processorTypes[queueName] = null;
        workerCounts[queueName] = null;

        bq_logger.info('Queue ' + queueName + ' destroyed.');

        return { "response": 'Queue ' + queueName + ' destroyed.' };

    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Destroy queue finish');
        return responseMessages.noredis;
    }
};

exports.queue_status = async function(options) {

    bq_logger.debug('Queue status start');

    if (redisReady) {
        bq_logger.debug('Redis ready');
        bq_logger.debug('Options: ' + JSON.stringify(options));

        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');


        setupQueue(queueName);

        if (bullQueues[queueName]) {
            bq_logger.debug('Queue: ' + queueName + " exists, so get queue job counts");
            let jobscount = await bullQueues[queueName].getJobCounts().catch(console.error);
            let workers_attached = false;


            if (workerCounts[queueName]) {
                bq_logger.debug('Queue: ' + queueName + ' has workers attached');
                workers_attached = true;
            } else {
                bq_logger.debug('Queue: ' + queueName + ' has no workers attached');
            }
            bq_logger.info('Queue: ' + queueName + ' status returned');
            bq_logger.debug('Queue: ' + queueName + ' status returned jobscounts: ', jobscount);

            return {
                "jobs_count": jobscount,
                "queue": queueName,
                "limiter": bullQueues[queueName].limiter || false,
                "workers_attached": workers_attached,
                "worker_count": workerCounts[queueName],
                "worker_type": processorTypes[queueName]
            };
        } else {
            bq_logger.error('Queue: ' + queueName + ' does not exist so nothing returned');
            bq_logger.error('Queue: ' + queueName + ' does not exist so nothing returned');
            return responseMessages['noqueue']
        }

    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Queue status finish');
        return responseMessages.noredis;
    }
};

exports.queue_clean = async function(options) {

    bq_logger.debug('Clean queue start');

    if (redisReady) {
        bq_logger.debug('Redis ready');
        bq_logger.debug('Options: ' + JSON.stringify(options));

        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');
        let job_status = this.parseOptional(options.job_status, 'string', '');

        let grace_period = this.parseOptional(options.grace_period, 'number', 0);
        setupQueue(queueName);

        if (bullQueues[queueName]) {
            bq_logger.debug('Queue: ' + queueName + " exists, so clean the queue");

            let cleaned = await bullQueues[queueName].clean(grace_period, job_status).catch(console.error);

            bq_logger.info('Queue: ' + queueName + ' removed ' + cleaned + ' jobs');
            return { "jobs_removed": cleaned };
        } else {
            bq_logger.error('Queue: ' + queueName + ' does not exist so nothing returned');
            return responseMessages['noqueue']
        }

    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Clean queue finish');
        return responseMessages.noredis;
    }
};

exports.queue_pause = async function(options) {

    bq_logger.debug('Pause queue start');

    if (redisReady) {
        bq_logger.debug('Redis ready');
        bq_logger.debug('Options: ' + JSON.stringify(options));

        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');
        setupQueue(queueName);

        if (bullQueues[queueName]) {
            bq_logger.debug('Queue: ' + queueName + " exists, so pause the queue");
            let pauseQueue = await bullQueues[queueName].pause({ isLocal: false, doNotWaitActive: true }).catch(console.error);

            bq_logger.info('Queue: ' + queueName + " paused");
            return { "response": pauseQueue };
        } else {
            bq_logger.error('Queue: ' + queueName + ' does not exist so nothing returned');
            return responseMessages['noqueue']

        }

    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Pause queue finish');
        return responseMessages.noredis;
    }
};

exports.queue_resume = async function(options) {

    bq_logger.debug('Resume queue start');

    if (redisReady) {

        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');
        setupQueue(queueName);

        if (bullQueues[queueName]) {
            bq_logger.debug('Queue: ' + queueName + " exists, so resume the queue");
            let resumeQueue = await bullQueues[queueName].resume({ isLocal: false }).catch(console.error);

            bq_logger.info('Queue: ' + queueName + " resumed");
            return { "response": resumeQueue };
        } else {
            bq_logger.error('Queue: ' + queueName + ' does not exist so nothing returned');
            return responseMessages['noqueue']
        }

    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Resume queue finish');
        return responseMessages.noredis;
    }
};
exports.get_all_jobs = async function(options) {
    if (redisReady) {
      let queueNames = options.queue_names || [];
      if (queueNames.length === 0) {
        return responseMessages['noqueuenames'];
        
      }
      let splitNames = queueNames.split(',');
      let jobs = [];
      for (let i = 0; i < splitNames.length; i++) {
        let queueName = splitNames[i];
        setupQueue(queueName);
        
        if (bullQueues[queueName]) {
          let job_status = this.parseRequired(options.job_status, 'string', 'parameter job_status is required.');
          let queueJobs;
          
          switch (job_status) {
            case 'all':
              queueJobs = await bullQueues[queueName].getJobs().catch(console.error);
              break;
            case 'failed':
              queueJobs = await bullQueues[queueName].getFailed().catch(console.error);
              break;
            case 'completed':
              queueJobs = await bullQueues[queueName].getCompleted().catch(console.error);
              break;
            case 'delayed':
              queueJobs = await bullQueues[queueName].getDelayed().catch(console.error);
              break;
            case 'waiting':
              queueJobs = await bullQueues[queueName].getWaiting().catch(console.error);
              break;
            case 'active':
              queueJobs = await bullQueues[queueName].getActive().catch(console.error);
              break;
            default:
              return responseMessages['invalidstatus'];
          }
          
          if (queueJobs) {
            jobs.push(
              ...queueJobs.map(job => {
                let status;
                if (job.failedReason) {
                  status = 'failed';
                } else if (job.finishedOn) {
                  status = 'completed';
                } else if (job.delay > 0) {
                  status = 'delayed';
                } else if (job.processedOn) {
                  status = 'active';
                } else {
                  status = 'waiting';
                }
                
                return {
                  queueName: queueName,
                  id: job.id,
                  name: job.name,
                  status: status.toUpperCase(),
                  data: job.data,
                  opts: job.opts,
                  progress: job.progress(),
                  delay: job.delay,
                  timestamp: Math.floor(job.timestamp / 1000),
                  attemptsMade: job.attemptsMade,
                  failedReason: job.failedReason,
                  stacktrace: job.stacktrace,
                  returnvalue: job.returnvalue,
                  finishedOn: Math.floor(job.finishedOn / 1000),
                  processedOn: Math.floor(job.processedOn / 1000)
                };
              })
            );
          }
        }
      }
      return jobs;
}
}
exports.get_jobs = async function(options) {

    bq_logger.debug('Get jobs start');

    if (redisReady) {
        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');

        setupQueue(queueName);

        if (bullQueues[queueName]) {
            bq_logger.debug('Queue: ' + queueName + " exists, so get the jobs");

            let job_status = this.parseRequired(options.job_status, 'string', 'parameter job_status is required.');

            let jobs = null;
            bq_logger.debug('Getting jobs that have status: ' + job_status);
            switch (job_status) {
                case 'failed':
                    jobs = await bullQueues[queueName].getFailed().catch(console.error);
                    break;
                case 'completed':
                    jobs = await bullQueues[queueName].getCompleted().catch(console.error);
                    break;
                case 'delayed':
                    jobs = await bullQueues[queueName].getDelayed().catch(console.error);
                    break;
                case 'waiting':
                    jobs = await bullQueues[queueName].getWaiting().catch(console.error);
                    break;
                case 'active':
                    jobs = await bullQueues[queueName].getActive().catch(console.error);
                    break;
                default:
                    // code block
            }


            bq_logger.info('Returned ' + jobs.length + ' jobs');
            return { "jobs": jobs };
        } else {
            bq_logger.error('Queue: ' + queueName + ' does not exist so nothing returned');
            return responseMessages['noqueue']
        }

    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Create queue finish');
        return responseMessages.noredis;
    }
};
exports.retry_job = async function(options) {

    bq_logger.debug('Retry job start');

    if (redisReady) {

        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');

        setupQueue(queueName);

        if (bullQueues[queueName]) {


            let job_id = this.parseRequired(options.job_id, 'number', 'parameter job id is required.');

            bq_logger.debug('Queue: ' + queueName + " exists, so retry jobID: " + job_id);

            let job = await bullQueues[queueName].getJob(job_id);

            if (job) {

                try {
                    job_state = await job.retry();
                } catch (err) {
                    bq_logger.warn('JobID ' + job_id + ': ' + err.message);
                    return { "response": err.message }
                }

                bq_logger.info('JobID ' + job_id + ' queued for retry');
                return { "response": 'queued for retry' };

            } else {
                bq_logger.warn('JobID ' + job_id + ' not found');
                job_state = 'Job not found';
                return { "response": job_state };
            }


        } else {
            bq_logger.error('Queue: ' + queueName + ' does not exist so nothing returned');
            return responseMessages['noqueue'];
        }

    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Create queue finish');
        return responseMessages.noredis;
    }
};
exports.job_state = async function(options) {

    bq_logger.debug('Job state start');

    if (redisReady) {
        bq_logger.debug('Redis ready');
        bq_logger.debug('Options: ' + JSON.stringify(options));

        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');

        setupQueue(queueName);

        if (bullQueues[queueName]) {


            let job_id = this.parseRequired(options.job_id, 'string', 'parameter job id is required.');
            bq_logger.debug('Queue: ' + queueName + " exists, so get job state of jobID: " + job_id);

            let job = await jobState.getJob(job_id);

            if (job) {
                bq_logger.info('Returned job state for jobID: ' + job_id);
                job_state = await job.getState();

            } else {
                bq_logger.warn('JobID ' + job_id + ' not found');
                job_state = 'Job not found'

            }

            return { "job": job, "job_state": job_state };
        } else {
            bq_logger.error('Queue: ' + queueName + ' does not exist so nothing returned');
            return responseMessages['noqueue']
        }

    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Create queue finish');
        return responseMessages.noredis;
    }
};

exports.add_job = async function(options) {

    const bull_logging = this.parseOptional(options.bull_logging, 'string', 'false');

    var bullLog = false;

    if (bull_logging == 'true' || bull_logging == '1' || bull_logging) {
        bullLog = true;
    }
    bq_logger.debug('Add job start');

    if (redisReady) {
        bq_logger.debug('Redis ready');
        bq_logger.debug('Options: ' + JSON.stringify(options));

        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');
        let remove_on_complete = this.parseOptional(options.remove_on_complete, 'boolean', false);
        const keep_completed_jobs = this.parseOptional(
            options.keep_completed_jobs,
            "number",
            null
        );

        if (keep_completed_jobs !== null) {
            remove_on_complete = keep_completed_jobs;
        }
        
        let remove_on_fail;

        remove_on_fail = this.parseOptional(options.remove_on_fail, "boolean");

        const keep_failed_jobs = this.parseOptional(
            options.keep_failed_jobs,
            "number",
            null
        );

        if (keep_failed_jobs !== null) {
            remove_on_fail = keep_failed_jobs;
        }

        let attempts = parseInt(this.parseOptional(options.attempts, "*", 1));
        if (attempts <= 0) {
            throw new Error("The number of attempts must be a positive integer.");
        }

        let attempts_delay = parseInt(
            this.parseOptional(options.attempts_delay, "*", 0)
        );
        if (attempts_delay < 0) {
            throw new Error(
                "The delay between attempts must be a non-negative integer."
            );
        }

        let backoff_type = this.parseOptional(
            options.backoff_type,
            "string",
            "fixed"
        );
        if (backoff_type !== "fixed" && backoff_type !== "exponential") {
            throw new Error(
                "The backoff type must be either 'fixed' or 'exponential'."
            );
        }

        let priority = parseInt(this.parseOptional(options.priority, "number"));
        let repeat = this.parseOptional(options.repeatable, "boolean", false);

        let repeat_every = this.parseOptional(
            options.repeat_interval,
            "number",
            null
        );
        if (repeat_every !== null && repeat_every <= 0) {
            throw new Error("The repeat interval must be a positive integer.");
        }

        let repeat_limit = this.parseOptional(options.repeat_limit, "number", null);
        if (repeat_limit !== null && repeat_limit <= 0) {
            throw new Error("The repeat limit must be a positive integer.");
        }

        let repeat_pattern = this.parseOptional(
            options.repeat_pattern,
            "string",
            null
        );
        if (repeat_pattern !== null && !isValidCron(repeat_pattern)) {
            throw new Error("The repeat pattern must be a valid cron pattern.");
        }
        setupQueue(queueName);

        let libraryFile = this.parseRequired(options.library_file, 'string', 'parameter library_file is required.');
        let delay_ms = parseInt(this.parseOptional(options.delay_ms, '*', 0));


        try {
            var myRegexp = /(?<=lib\/).*/;
            var libraryName = myRegexp.exec(libraryFile)[0].replace('.json', '');

        } catch (error) {

            return { "error": "You must select a file from this project's app/modules/lib folder (or its children)" };
        }

        var jobData = this.parse(options.bindings) || {}
        let jobOptions = {
            delay: delay_ms,
            removeOnComplete: remove_on_complete,
            removeOnFail: remove_on_fail,
            attempts: attempts,
        };
        if (attempts > 1) {
            jobOptions.backoff = {
                type: backoff_type,
                delay: attempts_delay,
            };
        }

        if (priority !== null) {
            jobOptions.priority = priority;
        }

        let repeatOptions = {};
        if (repeat) {
            if (repeat_every) repeatOptions.every = repeat_every;
            if (repeat_limit) repeatOptions.limit = repeat_limit;
            if (repeat_pattern) repeatOptions.cron = repeat_pattern;
        }

        if (Object.keys(repeatOptions).length !== 0) {
            jobOptions.repeat = repeatOptions;
        }

        if (processorTypes[queueName] == 'library' || !workerCounts[queueName]) {
            const job = await bullQueues[queueName].add({

                jobData: jobData,
                action: libraryName,
                bullLog: bullLog,
                loggerOptions: { console_logging: console_logging, file_logging: file_logging, opensearch_logging: opensearch_logging}
            }, jobOptions).catch(console.error);

            return { "job_id": job.id, "queue": queueName };
        } else {
            return {
                "response": 'Queue ' + queueName + ' is not setup for Library processing.'
            };
        }



    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Create queue finish');
        return responseMessages.noredis;
    }
};

exports.add_job_api = async function(options) {

    bq_logger.debug('Add job api start');


    if (redisReady) {
        bq_logger.debug('Redis ready');
        bq_logger.debug('Options: ' + JSON.stringify(options));

        let queueName = this.parseRequired(options.queue_name, 'string', 'Queue name is required');
        let remove_on_complete = this.parseOptional(options.remove_on_complete, 'boolean', false);
        const keep_completed_jobs = this.parseOptional(
            options.keep_completed_jobs,
            "number",
            null
        );

        if (keep_completed_jobs !== null) {
            remove_on_complete = keep_completed_jobs;
        }
        
        let remove_on_fail;

        remove_on_fail = this.parseOptional(options.remove_on_fail, "boolean");

        const keep_failed_jobs = this.parseOptional(
            options.keep_failed_jobs,
            "number",
            null
        );

        if (keep_failed_jobs !== null) {
            remove_on_fail = keep_failed_jobs;
        }

        let attempts = parseInt(this.parseOptional(options.attempts, "*", 1));
        if (attempts <= 0) {
            throw new Error("The number of attempts must be a positive integer.");
        }

        let attempts_delay = parseInt(
            this.parseOptional(options.attempts_delay, "*", 0)
        );
        if (attempts_delay < 0) {
            throw new Error(
                "The delay between attempts must be a non-negative integer."
            );
        }

        let backoff_type = this.parseOptional(
            options.backoff_type,
            "string",
            "fixed"
        );
        if (backoff_type !== "fixed" && backoff_type !== "exponential") {
            throw new Error(
                "The backoff type must be either 'fixed' or 'exponential'."
            );
        }

        let priority = parseInt(this.parseOptional(options.priority, "number"));
        let repeat = this.parseOptional(options.repeatable, "boolean", false);

        let repeat_every = this.parseOptional(
            options.repeat_interval,
            "number",
            null
        );
        if (repeat_every !== null && repeat_every <= 0) {
            throw new Error("The repeat interval must be a positive integer.");
        }

        let repeat_limit = this.parseOptional(options.repeat_limit, "number", null);
        if (repeat_limit !== null && repeat_limit <= 0) {
            throw new Error("The repeat limit must be a positive integer.");
        }

        let repeat_pattern = this.parseOptional(
            options.repeat_pattern,
            "string",
            null
        );
        if (repeat_pattern !== null && !isValidCron(repeat_pattern)) {
            throw new Error("The repeat pattern must be a valid cron pattern.");
        }
        setupQueue(queueName);

        if (bullQueues[queueName]) {
            let apiFile = this.parseRequired(options.api_file, 'string', 'parameter api_file is required.');
            let delay_ms = parseInt(this.parseOptional(options.delay_ms, '*', 0));

            let base_url = this.global.data.$_SERVER.REQUEST_PROTOCOL + '://' + this.global.data.$_SERVER.SERVER_NAME + '/api/';
            if (this.global.data.$_SERVER.SERVER_NAME.includes('localhost')) {
                base_url = 'http://localhost:' + config.port + '/api/';
            }

            try {
                var myRegexp = /(?<=api\/).*/;
                var apiName = myRegexp.exec(apiFile)[0].replace('.json', '');

            } catch (error) {
                bq_logger.error('Attempt to use processing file from outside this project\'s app/api folder');
                return { "error": "You must select a file from this project's app/api folder (or its children)" };
            }

            var jobData = this.parse(options.bindings) || {}
            let jobOptions = {
                delay: delay_ms,
                removeOnComplete: remove_on_complete,
                removeOnFail: remove_on_fail,
                attempts: attempts,
            };
            if (attempts > 1) {
                jobOptions.backoff = {
                    type: backoff_type,
                    delay: attempts_delay,
                };
            }

            if (priority !== null) {
                jobOptions.priority = priority;
            }

            let repeatOptions = {};
            if (repeat) {
                if (repeat_every) repeatOptions.every = repeat_every;
                if (repeat_limit) repeatOptions.limit = repeat_limit;
                if (repeat_pattern) repeatOptions.cron = repeat_pattern;
            }

            if (Object.keys(repeatOptions).length !== 0) {
                jobOptions.repeat = repeatOptions;
            }

            if (processorTypes[queueName] == 'api' || !workerCounts[queueName]) {
                bq_logger.debug('Add job to queue: ' + bullQueues[queueName]);
                const job = await bullQueues[queueName].add({

                    jobData: jobData,
                    action: apiName,
                    baseURL: base_url,
                    bullLog: bullLog,
                    loggerOptions: { console_logging: console_logging, file_logging: file_logging, opensearch_logging: opensearch_logging}
                }, jobOptions).catch((error) => {
                    bq_logger.error('Add job to queue failed: ' + error.message);
                });

                bq_logger.info('Job submitted to queue: ' + queueName + ' with JobID: ' + job.id);

                return { "job_id": job.id, "queue": queueName };
            } else {
                bq_logger.warn('Queue ' + queueName + ' is not setup for API processing.');
                return {
                    "response": 'Queue ' + queueName + ' is not setup for API processing.'
                };
            }


        } else {
            bq_logger.error('Queue: ' + queueName + ' does not exist so nothing returned');
            return responseMessages['noqueue']
        }
    } else {
        bq_logger.error('No Redis connection');
        bq_logger.debug('Create queue finish');
        return responseMessages.noredis;
    }
};
exports.get_repeatable_jobs = async function(options) {
    bq_logger.debug("Get repeatable jobs start");

    if (redisReady) {
        bq_logger.debug(JSON.stringify(options));

        let queueName = this.parseRequired(
            options.queue_name,
            "string",
            "Queue name is required"
        );

        setupQueue(queueName);

        if (bullQueues[queueName]) {
            bq_logger.debug(`Queue: ${queueName} exists, so get the jobs`);

            let jobs = null;
            bq_logger.debug(`Getting repeatable jobs`);

            try {
                jobs = await bullQueues[queueName].getRepeatableJobs();
            } catch (error) {
                bq_logger.error(error.message);
            }

            bq_logger.info(`Returned ${jobs.length} jobs`);

            return { jobs: jobs };
        } else {
            bq_logger.error(`Queue: ${queueName} does not exist so nothing returned`);

            return responseMessages["noqueue"];
        }
    } else {
        bq_logger.error("No Redis connection");
        bq_logger.error("Get repeatable jobs finish");

        return responseMessages.noredis;
    }
};
function isValidCron(cron) {
    try {
        new CronJob(cron);
        return true;
    } catch (e) {
        return false;
    }
}
exports.remove_repeatable_job = async function(options) {
    bq_logger.debug("Remove repeatable job start");

    if (redisReady) {
        bq_logger.debug(options);

        let queueName = this.parseRequired(
            options.queue_name,
            "string",
            "Queue name is required"
        );

        let jobName = this.parseRequired(
            options.job_name,
            "string",
            "Job name is required"
        );

        setupQueue(queueName);

        if (bullQueues[queueName]) {
            bq_logger.debug(`Queue: ${queueName} exists, removing job: ${jobName}`);

            let repeatableJobs = await bullQueues[queueName].getRepeatableJobs();
            let job = repeatableJobs.find((job) => job.name === jobName);

            if (job) {
                try {
                    await bullQueues[queueName].removeRepeatableByKey(job.key);
                    bq_logger.debug(`Job: ${jobName} successfully removed`);

                    return { success: true };
                } catch (error) {
                    bq_logger.error(error.message);

                    return { success: false, error: error.message };
                }
            } else {
                bq_logger.error(`Job: ${jobName} does not exist`);

                return { success: false, error: `Job: ${jobName} does not exist` };
            }
        } else {
            bq_logger.error(`Queue: ${queueName} does not exist`);

            return responseMessages["noqueue"];
        }
    } else {
        bq_logger.error("No Redis connection");
        bq_logger.error("Remove repeatable job finish");

        return responseMessages.noredis;
    }
};