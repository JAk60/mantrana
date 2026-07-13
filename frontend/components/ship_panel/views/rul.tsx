const RULResultsTable = ({ ship, toolCalls }: { ship: string, toolCalls: any }) => {
  console.log('RULResultsTable received:', toolCalls);

  // Parse the response if it's a string
  let parsedResponse;
  try {
    if (typeof toolCalls === 'string') {
      parsedResponse = JSON.parse(toolCalls);
    } else {
      parsedResponse = toolCalls;
    }
  } catch (error) {
    console.error('Failed to parse response:', error);
    return (
      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error parsing response data</p>
      </div>
    );
  }

  // Extract RUL data from tool_calls
  // Backend shape: tool_calls[0].result.data  → { status, data: [...], summary, description, urgency_level }
  const toolCall = Array.isArray(parsedResponse) ? parsedResponse[0] : parsedResponse;
  const resultData = toolCall?.result?.data;
  console.log('resultData', resultData);

  // Support both old shape (resultData.results) and new shape (resultData.data)
  const equipmentResults: any[] = resultData?.data ?? resultData?.results ?? [];
  const summary = resultData?.summary;

  if (!equipmentResults.length) {
    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600 text-center">No RUL results found</p>
      </div>
    );
  }

  // Flatten sensor data into table rows
  const tableRows: any[] = [];
  equipmentResults.forEach((equipmentResult: any) => {
    Object.entries(equipmentResult.sensors ?? {}).forEach(([sensorName, sensorData]: [string, any]) => {
      tableRows.push({
        ship: ship,
        equipment: equipmentResult.nomenclature,
        sensor: sensorName,
        rul_80: sensorData.Table?.['0.8'] ?? sensorData.remaining_life?.[0] ?? null,
        rul_85: sensorData.Table?.['0.85'] ?? sensorData.remaining_life?.[1] ?? null,
        rul_90: sensorData.Table?.['0.9'] ?? sensorData.remaining_life?.[2] ?? null,
        rul_95: sensorData.Table?.['0.95'] ?? sensorData.remaining_life?.[3] ?? null,
        beta: sensorData.weibull_params?.beta,
        eta: sensorData.weibull_params?.eta,
        vc: sensorData.latest_readings?.vc,
        tp: sensorData.latest_readings?.tp,
        t0: sensorData.latest_readings?.t0,
      });
    });
  });

  // Find the row with the lowest RUL at 90% confidence
  const lowestRULIndex = tableRows.reduce((minIndex, row, currentIndex, array) => {
    const current = row.rul_90 ?? Infinity;
    const best = array[minIndex].rul_90 ?? Infinity;
    return current < best ? currentIndex : minIndex;
  }, 0);

  const fmt = (v: number | null) => (v != null ? v.toFixed(2) + ' hrs' : '—');

  return (
    <div className="mt-6 space-y-4">
      <style>{`
        @keyframes blink-red {
          0%, 100% { background-color: rgba(239, 68, 68, 0.2); }
          50%       { background-color: rgba(239, 68, 68, 0.5); }
        }
        .blink-critical {
          animation: blink-red 1.5s ease-in-out infinite;
        }
      `}</style>

      {/* Query Info */}
      <div className="bg-card/70 border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">RUL Analysis Results</h3>
          <span className="text-sm text-muted-foreground">
            {summary?.total_sensors_analyzed ?? tableRows.length} sensor
            {(summary?.total_sensors_analyzed ?? tableRows.length) !== 1 ? 's' : ''} analyzed
          </span>
        </div>

        {/* Urgency badge */}
        {/* {resultData?.urgency_level && (
          <div className="mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              resultData.urgency_level.startsWith('CRITICAL') ? 'bg-red-100 text-red-800' :
              resultData.urgency_level.startsWith('HIGH')     ? 'bg-orange-100 text-orange-800' :
              resultData.urgency_level.startsWith('MODERATE') ? 'bg-yellow-100 text-yellow-800' :
                                                                 'bg-green-100 text-green-800'
            }`}>
              {resultData.urgency_level}
            </span>
          </div>
        )} */}

        {/* Description */}
        {/* {resultData?.description && (
          <p className="text-sm text-muted-foreground">{resultData.description}</p>
        )} */}
      </div>

      {/* Results Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                {['Ship', 'Equipment', 'Sensor', 'RUL @ 80%', 'RUL @ 85%', 'RUL @ 90%', 'RUL @ 95%'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-sm font-medium text-foreground border-b border-border">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, index: number) => (
                <tr
                  key={index}
                  className={`${index === lowestRULIndex
                    ? 'blink-critical'
                    : index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    }`}
                >
                  <td className="px-4 py-3 text-sm text-foreground border-b border-border/50">{row.ship}</td>
                  <td className="px-4 py-3 text-sm text-foreground border-b border-border/50">{row.equipment}</td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground border-b border-border/50">{row.sensor}</td>
                  <td className="px-4 py-3 text-sm text-foreground border-b border-border/50">{fmt(row.rul_80)}</td>
                  <td className="px-4 py-3 text-sm text-foreground border-b border-border/50">{fmt(row.rul_85)}</td>
                  <td className="px-4 py-3 text-sm text-foreground border-b border-border/50">{fmt(row.rul_90)}</td>
                  <td className="px-4 py-3 text-sm text-foreground border-b border-border/50">{fmt(row.rul_95)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RULResultsTable;