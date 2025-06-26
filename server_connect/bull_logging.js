const { format, createLogger, transports } = require("winston");
const { Client } = require('@opensearch-project/opensearch');
const { combine, timestamp, label, printf, colorize, padLevels } = format;
const DailyRotateFile = require("winston-daily-rotate-file");
const Transport = require('winston-transport');
require("dotenv").config();

const myFormat = printf(({ level, message, ...metadata }) => {
  const dateTime = new Date().toISOString();
  return `${dateTime} ${level}: ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata, null, 4) + "\n" : ""
    }`;
});
const currentDate = new Date();
const year = currentDate.getFullYear();
const month = (currentDate.getMonth() + 1).toString().padStart(2, "0"); // Adding 1 to the month as it is zero-based index
const opsUser = process.env.OPS_USERNAME;
const opsPass = process.env.OPS_PASSWORD;
const bullLogsIndex = process.env.BULL_LOGS_INDEX;
const opensearchConfig = {
  node: process.env.OPS_URL,
  auth: {
    username: opsUser,
    password: opsPass,
  },
  ssl: {
    rejectUnauthorized: false,
  },
  headers: {
    'Content-Type': 'application/json',
  }
};
class OpenSearchTransport extends Transport {
  constructor(opensearchClient) {
    super();
    this.opensearchClient = opensearchClient;
  }

  log(info, callback) {
    const dateTime = new Date().toISOString();
    const logObject = {
      timestamp: dateTime,
      log_level: info.level.toUpperCase(),
      message: typeof info.message != 'object' ? info.message : null,
      domain: process.env.DOMAIN,
      service: "Bull Queues",
      context: info.data && typeof info.data.jobData === 'object' ? { ...info.data.jobData, job_id: info.job_id } : { data: info.data && info.data.jobData, job_id: info.job_id },
    };
    // Send logs to OpenSearch
    this.opensearchClient.index({
      index: `${bullLogsIndex}-${year}.${month}`, // Index name to store logs
      body: logObject,
      refresh: true, // Optional: Set to true if you want the logs to be immediately searchable
    })
      .then(() => {
        console.log('Logs successfully sent to OpenSearch.');
        callback();
      })
      .catch((error) => {
        console.error('Failed to send logs to OpenSearch:', error);
        callback(error);
      });
  }
}

module.exports = {
  setupWinston: function (console_logging = "error", file_logging = "none", category, opensearch_logging) {
    let logTransports = [
      new transports.Console({
        level: console_logging,
        format: combine(label({
          label: category,
          message: true
        }), padLevels(), colorize(), myFormat),
      }),
    ];

    if (file_logging !== "none") {
      logTransports.push(
        new DailyRotateFile({
          level: file_logging,
          filename: "logs/bull-queue-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          maxFiles: "14d",
          format: combine(label({
            label: category,
            message: true
          }), padLevels(), myFormat),
        })
      );
    }
    if (opensearch_logging) {
        // Create an OpenSearch client
        const opensearchClient = new Client(opensearchConfig);

        // Add OpenSearch transport
        const opensearchTransport = new OpenSearchTransport(opensearchClient);
        logTransports.push(opensearchTransport);
    }

    return createLogger({
      transports: logTransports,
    });
  },
};