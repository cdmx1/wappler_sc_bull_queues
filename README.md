# Wappler Bull Queues

## Functionality
Allows for the creation of one to many queues to offload the execution of Wappler library tasks

## Requirements
* Functioning Redis connection, specified within the Wappler server config or a Redis connection defined with ENV variables

## Installation
* In your project folder, create /extensions/server_connect/modules (if it does not yet exist)
* Unzip the source code into /extensions/server_connect/modules (5 files)
* Refresh the Server Actions panel (restarting Wappler is also an option)
* The required libraries will be installed automatically upon use and next deployment
* You should now have a Bull Queues group in your available actions list for server workflows

## Optional ENV Variables
* REDIS_PORT: The Redis port
* REDIS_HOST: The Redis host
* REDIS_BULL_QUEUE_DB: The Redis database for bull queues
* REDIS_PASSWORD: The Redis password
* REDIS_USER: The Redis user
* REDIS_TLS: The TLS certificate. Define it is {} if you need a TLS connection without defining a cert.
* REDIS_PREFIX: The prefix for the database. This is useful if you need to connect to a clusert.
* REDIS_BULL_METRICS: Boolean. Enables Bull metrics collection which can be visualised with a GUI like https://taskforce.sh/
* REDIS_BULL_METRICS_TIME: The timeframe for metric collection. Defaults to TWO_WEEKS if metrics are enabled
* BULL_LOGS_INDEX: Index name to be used for bull logs, eg: nodejs-logs, This will be suffixed with -${year}.${month}.

## Actions
### Configure logging
Three types of logging are supported with log levels of Error, Warn, Info, Debug.  The logging action configures logging globally for all other bull queue actions that execute after it.

1. Console
* Always on, defaults to log_level: Error

2. File
* Enabled by providing the desired log level
* Disabled with 'none' or empty
* Defaults to disabled
* Creates a daily rotated text file in /logs of the app
* Keeps 14 days of logs

3. Bull (integrated bull queue job logging suitable for UI like Bull Board)
* Enabled with value of true
* Disabled with value of false

4. OpenSearch (optional)
* Enabled with value of true and required ENV variables
* Disabled with value of false

### Create Queue
* Creates a queue with optional parameters
* Responds with message indicating result

Queue Parameters
* Queue name - Used to specify a unique queue and is used by actions to specify the queue
* Number of concurrent jobs - The number of jobs that can be run in parallel for this queue
* Max jobs - The maximum number of jobs to be run within a given duration
* Duration for max jobs - Number of milliseconds used when calculating max jobs
* Processor type - 'library' (default) or 'api'
* The default parameters are 5 concurrent jobs, and no rate limiting (no max jobs, and no duration)

Rate limiting
* By using the max jobs and duration parameters for a queue, a queue can limit how quickly jobs are processed.  For example if the library uses an external api that limits usage to 1 request per second, the queue can be configured with Max jobs = 1, and Duration = 1000

### Pause Queue
* Pauses processing of jobs in the specified queue.
* Jobs remain in the queue and will resume processing when resumed.

### Resume Queue
* Resumes processing of jobs in the specified queue.

### Add Job
* Add a job into a queue
* The job will execute the specified Library File, passing it the PARAM values provided
* The job id is also provided to the library and can be accessed using $_PARAM.id
* Optionally create a queue with the default set of parameters (see below)
* Optionally delay job x number of milliseconds (v 1.1.0)
* Optionally remove the job from the queue when completed (v 1.2.0)
* Responds with the job id
* NOTE: The Add Job action currently does not work if it is executed from a previously submitted job. In other words, if you are doing an iteration where you submit new jobs from a previously submitted job, it will fail. Use the Add Job API instead.

#### Advanced Job Options
* `remove_on_complete` / `keep_completed_jobs`: Remove job from queue when completed (boolean or number)
* `remove_on_fail` / `keep_failed_jobs`: Remove job from queue when failed (boolean or number)
* `attempts`: Number of retry attempts (integer)
* `attempts_delay`: Delay between attempts in ms (integer)
* `backoff_type`: 'fixed' or 'exponential' (string)
* `priority`: Job priority (integer)
* `repeatable`: Whether the job should repeat (boolean)
* `repeat_interval`: Repeat interval in ms (integer)
* `repeat_limit`: Max number of repeats (integer)
* `repeat_pattern`: Cron pattern for repeat (string)

### Add Job API
* Add a job into a queue
* The job will execute the specified API File, passing it the POST values provided
* The job id is also provided to the library and can be accessed using $_POST.id
* Optionally create a queue with the default set of parameters (see below)
* Optionally delay job x number of milliseconds
* Optionally remove the job from the queue when completed
* Optionally remove the job from the queue when failed
* Responds with the job id

#### Advanced Job Options
* Same as Add Job above

### Retry job
Allows resubmitting a job for processing via job id

### Queue Status
* Returns the job counts for the specified queue (Active, completed, waiting, delayed, etc.)

### Queue Clean
* Removes jobs from a queue by job status
* Optionally set grace period to retain newer jobs while deleting old
* Job status choices: Completed, Delayed, Failed (Active jobs cannot be removed, Waiting not support by Bull queue library)

### Job State
* Returns the job details for a given job id, along with the current status

### Get Jobs
* Retrieve jobs by job status from a specified queue
* Job choices: Active, Failed, Waiting, Delayed, Completed

### Get All Jobs
* Retrieve jobs by job status from multiple queues at once
* Specify a comma-separated list of queue names
* Job choices: Active, Failed, Waiting, Delayed, Completed, All

### Repeatable Jobs
* **Get Repeatable Jobs**: List all repeatable jobs for a queue
* **Remove Repeatable Job**: Remove a repeatable job from a queue by name

### Destroy Queue
* Forecably destroys a given queue
* Removes any and all jobs from the queue (any jobs currently running will complete)
* Resets the job id back to 1


