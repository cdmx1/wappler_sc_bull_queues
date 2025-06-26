// JavaScript Document
const bullLogging = require('./bull_logging.js');
const fs = require('fs-extra');
const App = require('../../../lib/core/app');

module.exports = async (job, done) => {
    const { bullLog, loggerOptions, action, jobData } = job.data;
    job = { ...job, ...jobData };

    const logger = bullLogging.setupWinston(
        loggerOptions.console_logging,
        loggerOptions.file_logging,
        'BullQLibraryJob',
        loggerOptions.opensearch_logging
    );

    logger.debug(`Processing job ${job.id} with library: ${action}`);

    if (bullLog) {
        const logJobProcessing = `Processing job ${job.id} with library: ${action}`;
        // const logRequestSending = `Sending request to library: ${action} with data: ${JSON.stringify(job)}`;

        logger.info({ job_id: job.id, action, message: logJobProcessing });
        logger.info(job);
    }
    const app = new App({ params: job, session: {}, cookies: {}, signedCookies: {}, query: {}, headers: {} });
    const actionFile = await fs.readJSON(`app/modules/lib/${action}.json`);

    app
        .define(actionFile, true)
        .then(() => {
            logger.info({ job_id: job.id, message: "Job completed successfully" })
            done();
        })
        .catch((err) => {
            logger.error({ job_id: job.id, message: err.message });
            done(err);
        });
};