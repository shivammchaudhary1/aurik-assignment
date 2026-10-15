const REASONS = {
  vibration: 'VIBRATION_ALERT',
  temperature: 'TEMPERATURE_ALERT',
  power: 'POWER_ALERT',
  sensor_health: 'SENSOR_HEALTH_DEGRADED',
  inspection: 'INSPECTION_DEFECT',
  maintenance_update: 'MAINTENANCE_DUE',
  operator_note: 'OPERATOR_OBSERVATION',
  calibration: 'CALIBRATION_PENDING',
  work_order: 'OPEN_WORK_ORDER',
};
const LEVELS = ['none', 'low', 'medium', 'high', 'critical'];

function latestByCategory(events) {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.eventTime) - new Date(b.eventTime) ||
      a.sourceId.localeCompare(b.sourceId)
  );
  const selected = new Map();
  for (const signal of sorted) {
    if (signal.category === 'recovery') {
      selected.clear(); // Recovery only clears this vendor's earlier sensor alerts.
      selected.set('recovery', signal);
    } else {
      selected.delete('recovery');
      selected.set(signal.category, signal);
    }
  }
  return [...selected.values()];
}

export function deriveMachineState(
  asset,
  allSignals,
  processedAt = new Date()
) {
  const grouped = new Map();
  for (const s of allSignals) {
    if (!grouped.has(s.vendor)) grouped.set(s.vendor, []);
    grouped.get(s.vendor).push(s);
  }
  const selected = [...grouped.values()].flatMap(latestByCategory);
  selected.sort((a, b) => new Date(b.eventTime) - new Date(a.eventTime));
  let level = 0;
  const reasons = new Set();
  for (const signal of selected) {
    let current = signal.level;
    if (signal.category === 'recovery') current = 0;
    // Asset thresholds apply only to compatible engineering units.
    // ThermexWatch's vibrationG is *not* directly convertible to vibrationMmS.
    if (
      signal.category !== 'recovery' &&
      signal.metrics?.temperatureC != null &&
      asset.ratedMaxTempC != null &&
      signal.metrics.temperatureC > asset.ratedMaxTempC
    ) {
      current = Math.max(current, 3);
      reasons.add('TEMPERATURE_ABOVE_RATED_LIMIT');
    }
    if (
      signal.category !== 'recovery' &&
      signal.metrics?.vibrationMmS != null &&
      asset.ratedMaxVibrationMmS != null &&
      signal.metrics.vibrationMmS > asset.ratedMaxVibrationMmS
    ) {
      current = Math.max(current, 3);
      reasons.add('VIBRATION_ABOVE_RATED_LIMIT');
    }
    level = Math.max(level, current);
    if (current > 0 && REASONS[signal.category])
      reasons.add(REASONS[signal.category]);
    if (current === 4 && signal.category === 'inspection')
      reasons.add('MAJOR_INSPECTION_DEFECT');
  }
  // Asset reference says EQ-007 is in maintenance; this is not a sensor recovery.
  const isMaintenance = asset.assetStatus === 'maintenance';
  if (isMaintenance) {
    level = Math.max(level, 2);
    reasons.add('ASSET_UNDER_MAINTENANCE');
  }
  const status =
    !selected.length && !isMaintenance
      ? 'unknown'
      : level === 4
        ? 'critical'
        : level === 3
          ? 'high'
          : level === 2
            ? 'warning'
            : level === 1
              ? 'watch'
              : 'normal';
  return {
    machineId: asset.machineId,
    plantId: asset.plantId,
    lineId: asset.lineId,
    derivedStatus: status,
    attentionLevel: LEVELS[level],
    needsAttention: level > 0,
    reasonCodes: [...reasons].sort(),
    latestRelevantEventTime: selected.length
      ? new Date(Math.max(...selected.map((s) => +new Date(s.eventTime))))
      : null,
    sourceEventRefs: selected.map((s) => ({
      vendor: s.vendor,
      sourceId: s.sourceId,
      eventTime: s.eventTime,
      category: s.category,
    })),
    latestSignals: selected.map((s) => ({
      vendor: s.vendor,
      sourceId: s.sourceId,
      eventType: s.eventType,
      category: s.category,
      level: s.level,
      eventTime: s.eventTime,
    })),
    lastProcessedAt: processedAt,
  };
}

export function presentState(asset, state, now = new Date()) {
  const staleAfterMs = Number(process.env.STALE_AFTER_HOURS || 24) * 3600000;
  const latest = state?.latestRelevantEventTime;
  const isStale =
    !latest || now.getTime() - new Date(latest).getTime() > staleAfterMs;
  return {
    machine_id: asset.machineId,
    plant_id: asset.plantId,
    line_id: asset.lineId,
    machine_type: asset.machineType,
    asset_status: asset.assetStatus,
    derived_status: state?.derivedStatus || 'unknown',
    attention_level: state?.attentionLevel || 'none',
    needs_attention: state?.needsAttention || false,
    reason_codes: state?.reasonCodes || [],
    latest_relevant_event_time: latest || null,
    processing_status: state ? 'processed' : 'no_signals_processed',
    freshness: {
      is_stale: isStale,
      stale_after_hours: Number(process.env.STALE_AFTER_HOURS || 24),
    },
    source_event_refs: state?.sourceEventRefs || [],
    latest_signals: state?.latestSignals || [],
    last_processed_at: state?.lastProcessedAt || null,
  };
}
