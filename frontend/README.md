# Knowledge graph query
1. What is the downtime impact on Gas Turbine 1 when it is failed due to seizing.
The downtime impact on Gas Turbine 1 (GT1) when failed due to seizing includes:
- *Downtime duration*: 5 hours (from the Downtime node linked to the Performance Loss consequence, which is triggered by the Seizing failure mode).
- *Repair time*: 3 hours (from the Repair node linked to the Downtime node).
- *Logistics time*: 1 hour (from the Logistics node linked to the Downtime node).
- *Assembly time*: 1 hour (from the AssemblyTime node linked to the Downtime node).


2. List all equipment which have clogging as failure mode
GT1, GT2, GT3, GT4

3. List all failure modes on gas turbine
Clogging, Seizing, Leaking


{
    "model": "mistral-nemo:latest",
    "created_at": "2026-07-12T10:59:01.921343669Z",
    "response": "{\n  \"answer\": \"The downtime impact on Gas Turbine 1 when it fails due to seizing is 5 hours total.\",\n  \"entities_found\": [\"Gas Turbine 1\", \"Seizing\"],\n  \"relations_found\": [\"hasEquipment\", \"hasFailureMode\", \"PRODUCES\", \"LEADS_TO\", \"hasDowntime\", \"hasRepair\", \"hasLogistics\", \"hasAssemblyTime\"],\n  \"reasoning_paths\": [\n    { \"source\": \"Eastern Command\", \"relation\": \"hasFleet\",     \"target\": \"Fleet A\"      },\n    { \"source\": \"Fleet A\",         \"relation\": \"hasShip\",      \"target\": \"INS TUSHIL\"   },\n    { \"source\": \"INS TUSHIL\",      \"relation\": \"hasEquipment\", \"target\": \"Gas Turbine 1\" },\n    { \"source\": \"Gas Turbine 1\",    \"relation\": \"hasAssembly\", \"target\": \"Fuel System\"    },\n    { \"source\": \"Fuel System\",     \"relation\": \"hasSubassembly\",\"target\": \"BoosterPump\"   },\n    { \"source\": \"BoosterPump\",      \"relation\": \"hasFailureMode\",\"target\": \"Seizing\"       },\n    { \"source\": \"Seizing\",          \"relation\": \"PRODUCES\",     \"target\": \"Fuel flow interruption\"},\n    { \"source\": \"Fuel flow interruption\",\"relation\": \"LEADS_TO\",   \"target\": \"Performance Loss\"},\n    { \"source\": \"Performance Loss\",  \"relation\": \"hasDowntime\",  \"target\": \"Downtime\"       },\n    { \"source\": \"Downtime\",         \"relation\": \"hasRepair\",    \"target\": \"Repair: 3h\"      },\n    { \"source\": \"Downtime\",         \"relation\": \"hasLogistics\", \"target\": \"Logistics: 1h\"   },\n    { \"source\": \"Downtime\",         \"relation\": \"hasAssemblyTime\",\"target\": \"AssemblyTime: 1h\"}\n  ],\n  \"paths_traversed\": 0,\n  \"details\": [\n    {\"label\":\"Repair\",\"value\":\"3h\"},\n    {\"label\":\"Logistics\",\"value\":\"1h\"},\n    {\"label\":\"Assembly Time\",\"value\":\"1h\"}\n  ],\n  \"confidence\": \"high\"\n}",
    "done": true,
    "done_reason": "stop",
    "context": [
        3,
        4568,
        1584,
        1261,
        1439,
        5180,
        9467,
        1319,
        41535,
        36015,.......
    ],
    "total_duration": 3617149660,
    "load_duration": 163143002,
    "prompt_eval_count": 8976,
    "prompt_eval_duration": 18703000,
    "eval_count": 515,
    "eval_duration": 3410818000
}