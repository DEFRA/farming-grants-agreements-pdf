import {
  createMetricsLogger,
  StorageResolution,
  Unit
} from 'aws-embedded-metrics'
import { config } from '../../config.js'
import { createLogger } from './logging/logger.js'

const metricsCounter = async (metricName, value = 1) => {
  if (!config.get('isMetricsEnabled')) {
    return
  }

  try {
    const metricsLogger = createMetricsLogger()
    metricsLogger.putMetric(
      metricName,
      value,
      Unit.Count,
      StorageResolution.Standard
    )
    await metricsLogger.flush()
  } catch (err) {
    createLogger().error(err, err.message)
  }
}

export { metricsCounter }
