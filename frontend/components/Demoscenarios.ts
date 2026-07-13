// demoScenarios.ts
// Pre-computed prediction data for demo mode. Each entry maps a short
// scenario key to its display label, full scenario text, and the
// L1 (predclass_output) + L2 (LFapplier_output) payloads that would
// normally be returned by the API. In demo mode MainPage skips the
// network call entirely and loads these directly into the store.

export interface PredictionData {
  predclass_output: Record<string, Record<string, number>>;
  LFapplier_output: Record<string, Record<string, number>>;
}
export interface SubsystemScore {
  name: string;
  score: number;
}

export interface ShipDependabilityEntry {
  displayName: string;
  system_dependability: number;
  phases: PhaseScores;
  scenarioId: string;
  subsystems: SubsystemScore[];
}
export interface PhaseScores {
  harbour: number;
  cruise: number;
  action: number;
}

export interface DependabilityData {
  system_dependability: number;
  equipment_dependability: number[];
  phases: PhaseScores;
}

export interface DemoScenario {
  id: string;
  label: string;
  scenario: string;
  predictions: PredictionData;
  dependability: DependabilityData;
  // Shown when the user clicks the "Explain" button below the predictions.
  // A plain-language paragraph justifying why the scenario text maps to
  // the dominant values in each prediction bucket.
  explanation: string;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "shivalik_sonar",
    label: "",
    scenario:
      "At 0845 hours, a Shivalik-class stealth frigate was conducting operations in the coastal waters near Kerala, specifically at coordinates 11°06'N, 76°23'E. The vessel was actively engaged in fleet support activities when its sonar systems picked up an unknown contact at a distance of 8 nautical miles. This contact was on a direct collision course with the ship's starboard bow, necessitating immediate attention. The primary objective in this scenario was the identification of the unknown contact, all while ensuring that the operational availability of the vessel remained at its maximum. The situation demanded a careful balance between maintaining the ongoing mission and addressing the potential threat posed by the unidentified contact.",
    dependability: {
      system_dependability: 0.8912,
      equipment_dependability: [0.8901, 0.8234, 0.9001],
      phases: { harbour: 0.91, cruise: 0.87, action: 0.84 },
    },
    explanation:
      "The model classifies this as a Mission scenario rather than Maintenance because the frigate is actively engaged in fleet support activities, not a repair or upkeep task. Within Mission, Fleetsupport dominates the sub-mission split since that is explicitly the activity underway when the contact is detected. Criticality is scored High because the contact is on a direct collision course requiring immediate attention. The Action is IDENTIFY and the Entity is SHIP, since the task is to identify an unknown surface contact relative to the ship itself, not to evaluate equipment or select among fleet assets. TaskObjective points to InterrogationInterception rather than Gunfiring or MissileFiring, because no weapons engagement is described anywhere in the text — only detection and identification. Among the constraints, FLEET_AVAILABILITY is dominant because the scenario explicitly states operational availability must remain at its maximum, with RISK_SCORE elevated due to the collision threat. Finally, the ObjectiveFunction favors MAXIMUM_AVAILABILITY, directly mirroring the stated goal of preserving the ship's operational readiness while resolving the contact.",
    predictions: {
      predclass_output: {
        Category: { Maintenance: 0.052871550310482228, Mission: 0.9471284496895178 },
        SubMission: {
          Combat: 0.0642,
          Exercise: 0.0815,
          Fleetsupport: 0.7196,
          Sortie: 0.0281,
          Miscellaneous: 0.0329,
          Humanitarian: 0.0737,
        },
        Criticality: { High: 0.8452163158015966, Mid: 0.06642164027861633, Low: 0.088362043919787 },
        Level: { FLEET: 0.19892902029139664, SHIP: 0.6798640183608546, EQUIPMENT: 0.12120696134774885 },
        Action: { EVALUTE: 0.07723893831985452, IDENTIFY: 0.7095123485293593, SELECT_K_OUT_OF_N: 0.21324871315078608 },
        Entity: { EQUIPMENT: 0.10055410499995901, SHIP: 0.8300428487413765, WORKSHOP: 0.06940304625866449 },
        TaskObjective: {
          Gunfiring: 0.0521,
          InterrogationInterception: 0.7089,
          MaintenanceScheduling: 0.0621,
          Miscellaneous: 0.0099,
          MissileFiring: 0.0389,
          SearchAndRescue: 0.1281,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0.022748381511713142,
          BALANCING_LOADS: 0.2814181176905996,
          CAPABILITY: 0.000037663208244479496,
          CONFORMANCE: 0.00003637677982585734,
          ENDURANCE: 0.00007405615610922492,
          FLEET_AVAILABILITY: 0.8504276315555988573,
          FUEL: 0.0007186314643335075,
          LOGISTIC_TIME: 0.0003322117493803749,
          MANPOWER_AVAILABILITY: 0.00005189009185371905,
          RATION: 0.0003247891264876064,
          RELIABILITY: 0.0014824602297093795,
          RISK_SCORE: 0.5027605334762005464,
          SHIP_CLASS: 0.0000428644981083529,
          SPARES_AVAILABILITY: 0.008643901306954315,
          SPEED: 0.0000718230709899586,
          WORKING_HOURS: 0.000805961325773699,
          WORKSHOP_AVAILABILITY: 0.000022706758117335198,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0.035464642638505836,
          MAXIMUM_AVAILABILITY: 0.9572953031047338,
          MAXIMUM_CONFORMANCE: 0.0007263850406484851,
          MAXIMUM_RELIABILITY: 0.0002905674400264037,
          MINIMUM_COST: 0.005671131239322086,
          MINIMUM_DOWNTIME: 0.00024196723875619634,
          MINIMUM_RISK: 0.0003100032980072017,
        },
      },
      LFapplier_output: {
        Category: { Maintenance: 0, Mission: 0.9 },
        SubMission: { Combat: 0, Exercise: 0.2, Fleetsupport: 0.9, Sortie: 0, Miscellaneous: 0, Humanitarian: 0.1 },
        Criticality: { High: 0, Mid: 0.9, Low: 0.3 },
        Level: { FLEET: 0, SHIP: 0.9, EQUIPMENT: 0.7 },
        Action: { EVALUTE: 0, IDENTIFY: 0, SELECT_K_OUT_OF_N: 0.5 },
        Entity: { EQUIPMENT: 0, SHIP: 0.9, WORKSHOP: 0.1 },
        TaskObjective: {
          Gunfiring: 0,
          InterrogationInterception: 0.8,
          MaintenanceScheduling: 0.2,
          Miscellaneous: 0,
          MissileFiring: 0,
          SearchAndRescue: 0.2,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0,
          BALANCING_LOADS: 0.4,
          CAPABILITY: 0.4,
          CONFORMANCE: 0.3,
          ENDURANCE: 0.6,
          FLEET_AVAILABILITY: 0.9,
          FUEL: 0.4,
          LOGISTIC_TIME: 0.6,
          MANPOWER_AVAILABILITY: 0.6,
          RATION: 0.4,
          RELIABILITY: 0.8,
          RISK_SCORE: 0.6,
          SHIP_CLASS: 0.5,
          SPARES_AVAILABILITY: 0.5,
          SPEED: 0.7,
          WORKING_HOURS: 1,
          WORKSHOP_AVAILABILITY: 0.1,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0,
          MAXIMUM_AVAILABILITY: 0.9,
          MAXIMUM_CONFORMANCE: 0.7,
          MAXIMUM_RELIABILITY: 0.3,
          MINIMUM_COST: 0.3,
          MINIMUM_DOWNTIME: 0.2,
          MINIMUM_RISK: 0,
        },
      },
    },
  },

  {
    id: "destroyer_sar",
    label: "Destroyer – SAR near Sri Lanka",
    scenario:
      "At 2300 hours, a destroyer was involved in search and rescue operations approximately 19 nautical miles southwest of the Sri Lanka coast. During these operations, an unidentified object was detected on radar, closing in at a speed of 30 knots from a distance of less than 5 nautical miles. The immediate priority was to identify this object, which did not match any known profiles in the database. The crew had to ensure that their actions did not compromise the availability of critical resources, as the mission's success hinged on maintaining operational readiness and responsiveness.",
    dependability: {
      system_dependability: 0.7508,
      equipment_dependability: [0.7395, 0.7082, 0.8186],
      phases: { harbour: 0.82, cruise: 0.75, action: 0.68 },
    },
    explanation:
      "This is scored as a Mission scenario with Humanitarian as the dominant sub-mission, since the destroyer is already conducting search and rescue operations when the unidentified object appears — the underlying activity, not the new contact, defines the mission type. Criticality is High given the object is closing fast from under 5 nautical miles. Action is IDENTIFY and Entity is SHIP because the crew's task is to identify the contact relative to their own vessel. TaskObjective is dominated by SearchAndRescue, consistent with the ongoing rescue operation the ship is already performing. Among constraints, FLEET_AVAILABILITY and RISK_SCORE both sit high, reflecting the text's emphasis on maintaining operational readiness and responsiveness despite the emerging threat, which is also why ObjectiveFunction favors MAXIMUM_AVAILABILITY over cost- or time-minimizing objectives.",
    predictions: {
      predclass_output: {
        Category: { Maintenance: 0.12, Mission: 0.88 },
        SubMission: {
          Combat: 0.05,
          Exercise: 0.03,
          Fleetsupport: 0.08,
          Sortie: 0.02,
          Miscellaneous: 0.02,
          Humanitarian: 0.8,
        },
        Criticality: { High: 0.91, Mid: 0.06, Low: 0.03 },
        Level: { FLEET: 0.05, SHIP: 0.75, EQUIPMENT: 0.2 },
        Action: { EVALUTE: 0.05, IDENTIFY: 0.82, SELECT_K_OUT_OF_N: 0.13 },
        Entity: { EQUIPMENT: 0.08, SHIP: 0.86, WORKSHOP: 0.06 },
        TaskObjective: {
          Gunfiring: 0.02,
          InterrogationInterception: 0.07,
          MaintenanceScheduling: 0.02,
          Miscellaneous: 0.0,
          MissileFiring: 0.01,
          SearchAndRescue: 0.88,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0.01,
          BALANCING_LOADS: 0.12,
          CAPABILITY: 0.05,
          CONFORMANCE: 0.02,
          ENDURANCE: 0.08,
          FLEET_AVAILABILITY: 0.72,
          FUEL: 0.06,
          LOGISTIC_TIME: 0.04,
          MANPOWER_AVAILABILITY: 0.08,
          RATION: 0.03,
          RELIABILITY: 0.09,
          RISK_SCORE: 0.78,
          SHIP_CLASS: 0.02,
          SPARES_AVAILABILITY: 0.04,
          SPEED: 0.15,
          WORKING_HOURS: 0.06,
          WORKSHOP_AVAILABILITY: 0.01,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0.06,
          MAXIMUM_AVAILABILITY: 0.88,
          MAXIMUM_CONFORMANCE: 0.01,
          MAXIMUM_RELIABILITY: 0.02,
          MINIMUM_COST: 0.01,
          MINIMUM_DOWNTIME: 0.01,
          MINIMUM_RISK: 0.01,
        },
      },
      LFapplier_output: {
        Category: { Maintenance: 0, Mission: 0.8 },
        SubMission: { Combat: 0, Exercise: 0, Fleetsupport: 0.2, Sortie: 0, Miscellaneous: 0, Humanitarian: 0.9 },
        Criticality: { High: 0.9, Mid: 0.1, Low: 0 },
        Level: { FLEET: 0, SHIP: 0.9, EQUIPMENT: 0.3 },
        Action: { EVALUTE: 0, IDENTIFY: 0.8, SELECT_K_OUT_OF_N: 0.2 },
        Entity: { EQUIPMENT: 0, SHIP: 0.9, WORKSHOP: 0 },
        TaskObjective: {
          Gunfiring: 0,
          InterrogationInterception: 0.1,
          MaintenanceScheduling: 0,
          Miscellaneous: 0,
          MissileFiring: 0,
          SearchAndRescue: 1.0,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0,
          BALANCING_LOADS: 0.2,
          CAPABILITY: 0.3,
          CONFORMANCE: 0,
          ENDURANCE: 0.4,
          FLEET_AVAILABILITY: 0.9,
          FUEL: 0.3,
          LOGISTIC_TIME: 0.3,
          MANPOWER_AVAILABILITY: 0.5,
          RATION: 0.2,
          RELIABILITY: 0.6,
          RISK_SCORE: 0.9,
          SHIP_CLASS: 0.1,
          SPARES_AVAILABILITY: 0.2,
          SPEED: 0.8,
          WORKING_HOURS: 0.3,
          WORKSHOP_AVAILABILITY: 0,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0.2,
          MAXIMUM_AVAILABILITY: 0.9,
          MAXIMUM_CONFORMANCE: 0,
          MAXIMUM_RELIABILITY: 0.3,
          MINIMUM_COST: 0,
          MINIMUM_DOWNTIME: 0.2,
          MINIMUM_RISK: 0.1,
        },
      },
    },
  },

  {
    id: "talwar_humanitarian",
    label: "Talwar – Humanitarian, Bay of Bengal",
    scenario:
      "At 0937 hours, a Talwar-class corvette was providing humanitarian assistance in the Bay of Bengal, located 65 nautical miles northeast of the Sundarbans Delta. The vessel was navigating through adverse weather conditions, including heavy fog and strong currents, when its Sonar 2087 system detected an unidentified contact. This contact was situated 14 nautical miles away, bearing 315°, and moving at a speed of 30 knots. The corvette faced the dual challenge of identifying the contact while managing critically low fuel supplies, which were only sufficient to sustain operations until 1600 hours. Additionally, a lifeboat had detached from the rescue effort and was drifting uncontrollably, adding to the complexity of the situation. The crew's focus remained on maintaining operational availability despite these constraints.",
    dependability: {
      system_dependability: 0.6934,
      equipment_dependability: [0.6712, 0.6501, 0.7589],
      phases: { harbour: 0.74, cruise: 0.69, action: 0.61 },
    },
    explanation:
      "The corvette is explicitly described as providing humanitarian assistance, so Category resolves to Mission and SubMission resolves to Humanitarian with high confidence. Criticality is scored at the top of the High band because the scenario stacks multiple urgent factors at once: an unidentified contact, a drifting lifeboat, and a hard fuel deadline. Action and Entity again land on IDENTIFY and SHIP, since the immediate task is contact identification. TaskObjective favors SearchAndRescue over InterrogationInterception because the detached, drifting lifeboat makes rescue the overriding objective alongside identification. The constraint set is dominated by FUEL and ENDURANCE rather than the FLEET_AVAILABILITY seen in the other scenarios, because the text is specific about fuel only lasting until 1600 hours — a hard operational limiter — while RISK_SCORE stays elevated from the combination of weather, the unknown contact, and the rescue in progress. ObjectiveFunction still favors MAXIMUM_AVAILABILITY, matching the crew's stated focus on maintaining operational availability despite these constraints.",
    predictions: {
      predclass_output: {
        Category: { Maintenance: 0.09, Mission: 0.91 },
        SubMission: {
          Combat: 0.02,
          Exercise: 0.01,
          Fleetsupport: 0.03,
          Sortie: 0.01,
          Miscellaneous: 0.01,
          Humanitarian: 0.92,
        },
        Criticality: { High: 0.95, Mid: 0.04, Low: 0.01 },
        Level: { FLEET: 0.04, SHIP: 0.68, EQUIPMENT: 0.28 },
        Action: { EVALUTE: 0.04, IDENTIFY: 0.79, SELECT_K_OUT_OF_N: 0.17 },
        Entity: { EQUIPMENT: 0.09, SHIP: 0.82, WORKSHOP: 0.09 },
        TaskObjective: {
          Gunfiring: 0.01,
          InterrogationInterception: 0.04,
          MaintenanceScheduling: 0.03,
          Miscellaneous: 0.0,
          MissileFiring: 0.01,
          SearchAndRescue: 0.91,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0.01,
          BALANCING_LOADS: 0.08,
          CAPABILITY: 0.06,
          CONFORMANCE: 0.02,
          ENDURANCE: 0.7,
          FLEET_AVAILABILITY: 0.15,
          FUEL: 0.82,
          LOGISTIC_TIME: 0.07,
          MANPOWER_AVAILABILITY: 0.09,
          RATION: 0.06,
          RELIABILITY: 0.1,
          RISK_SCORE: 0.65,
          SHIP_CLASS: 0.02,
          SPARES_AVAILABILITY: 0.04,
          SPEED: 0.2,
          WORKING_HOURS: 0.08,
          WORKSHOP_AVAILABILITY: 0.01,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0.12,
          MAXIMUM_AVAILABILITY: 0.82,
          MAXIMUM_CONFORMANCE: 0.01,
          MAXIMUM_RELIABILITY: 0.02,
          MINIMUM_COST: 0.01,
          MINIMUM_DOWNTIME: 0.01,
          MINIMUM_RISK: 0.01,
        },
      },
      LFapplier_output: {
        Category: { Maintenance: 0, Mission: 0.9 },
        SubMission: { Combat: 0, Exercise: 0, Fleetsupport: 0.1, Sortie: 0, Miscellaneous: 0, Humanitarian: 1.0 },
        Criticality: { High: 1.0, Mid: 0, Low: 0 },
        Level: { FLEET: 0, SHIP: 0.8, EQUIPMENT: 0.4 },
        Action: { EVALUTE: 0, IDENTIFY: 0.8, SELECT_K_OUT_OF_N: 0.2 },
        Entity: { EQUIPMENT: 0.1, SHIP: 0.8, WORKSHOP: 0 },
        TaskObjective: {
          Gunfiring: 0,
          InterrogationInterception: 0.1,
          MaintenanceScheduling: 0,
          Miscellaneous: 0,
          MissileFiring: 0,
          SearchAndRescue: 1.0,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0,
          BALANCING_LOADS: 0.1,
          CAPABILITY: 0.3,
          CONFORMANCE: 0,
          ENDURANCE: 0.9,
          FLEET_AVAILABILITY: 0.3,
          FUEL: 1.0,
          LOGISTIC_TIME: 0.4,
          MANPOWER_AVAILABILITY: 0.5,
          RATION: 0.4,
          RELIABILITY: 0.5,
          RISK_SCORE: 0.8,
          SHIP_CLASS: 0,
          SPARES_AVAILABILITY: 0.2,
          SPEED: 0.4,
          WORKING_HOURS: 0.3,
          WORKSHOP_AVAILABILITY: 0,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0.3,
          MAXIMUM_AVAILABILITY: 0.8,
          MAXIMUM_CONFORMANCE: 0,
          MAXIMUM_RELIABILITY: 0.2,
          MINIMUM_COST: 0,
          MINIMUM_DOWNTIME: 0.3,
          MINIMUM_RISK: 0.2,
        },
      },
    },
  },

  {
    id: "shivalik_drone",
    label: "Shivalik – Hostile Drones (Odisha)",
    scenario:
      "At 0635 hours, a Shivalik-class frigate was engaged in missile firing operations near the Odisha coast, at coordinates 19°38'N, 85°40'E. The mission took an unexpected turn when a swarm of hostile drones was detected at a distance of 7 nautical miles, closing in at 30 knots and approaching the perimeter of the ship's missile engagement zone. The frigate's crew had to prioritize the identification of these drones while carefully managing the ship's load balancing, as the stability and accuracy of the missile launch system had been impacted. The situation required a delicate balance between addressing the immediate threat and maintaining the operational integrity of the vessel.",
    dependability: {
      system_dependability: 0.7214,
      equipment_dependability: [0.7489, 0.6103, 0.8051],
      phases: { harbour: 0.79, cruise: 0.72, action: 0.65 },
    },
    explanation:
      "The scenario represents a Combat sub-mission within the Mission category because it involves responding to a coordinated hostile force that poses an immediate operational threat. Combat therefore dominates SubMission rather than Exercise or Fleetsupport. Criticality is assessed as High due to the presence of an active and credible hostile threat requiring an immediate military response. Action is IDENTIFY, as the initial operational priority is to identify, classify, and maintain situational awareness of the hostile force before and during engagement. TaskObjective is dominated by MissileFiring because the mission requires neutralizing hostile forces through coordinated combat operations rather than routine surveillance or interception. Among the constraints, BALANCING_LOADS is dominant since successful execution depends on effectively distributing operational workload and combat responsibilities across the assigned force package, while RISK_SCORE remains High because of the immediate threat to maritime security. ObjectiveFunction is MAXIMUM_AVAILABILITY, reflecting the need to maintain maximum operational readiness and sustained combat capability throughout the mission while ensuring successful threat neutralization.",
    predictions: {
      predclass_output: {
        Category: { Maintenance: 0.07, Mission: 0.93 },
        SubMission: {
          Combat: 0.88,
          Exercise: 0.02,
          Fleetsupport: 0.02,
          Sortie: 0.03,
          Miscellaneous: 0.03,
          Humanitarian: 0.02,
        },
        Criticality: { High: 0.93, Mid: 0.05, Low: 0.02 },
        Level: { FLEET: 0.07, SHIP: 0.72, EQUIPMENT: 0.21 },
        Action: { EVALUTE: 0.08, IDENTIFY: 0.75, SELECT_K_OUT_OF_N: 0.17 },
        Entity: { EQUIPMENT: 0.12, SHIP: 0.78, WORKSHOP: 0.1 },
        TaskObjective: {
          Gunfiring: 0.08,
          InterrogationInterception: 0.07,
          MaintenanceScheduling: 0.03,
          Miscellaneous: 0.0,
          MissileFiring: 0.79,
          SearchAndRescue: 0.03,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0.02,
          BALANCING_LOADS: 0.87,
          CAPABILITY: 0.04,
          CONFORMANCE: 0.02,
          ENDURANCE: 0.05,
          FLEET_AVAILABILITY: 0.08,
          FUEL: 0.05,
          LOGISTIC_TIME: 0.03,
          MANPOWER_AVAILABILITY: 0.06,
          RATION: 0.02,
          RELIABILITY: 0.12,
          RISK_SCORE: 0.85,
          SHIP_CLASS: 0.02,
          SPARES_AVAILABILITY: 0.05,
          SPEED: 0.06,
          WORKING_HOURS: 0.04,
          WORKSHOP_AVAILABILITY: 0.01,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0.08,
          MAXIMUM_AVAILABILITY: 0.78,
          MAXIMUM_CONFORMANCE: 0.01,
          MAXIMUM_RELIABILITY: 0.04,
          MINIMUM_COST: 0.01,
          MINIMUM_DOWNTIME: 0.02,
          MINIMUM_RISK: 0.06,
        },
      },
      LFapplier_output: {
        Category: { Maintenance: 0, Mission: 0.9 },
        SubMission: { Combat: 1.0, Exercise: 0, Fleetsupport: 0, Sortie: 0.1, Miscellaneous: 0, Humanitarian: 0 },
        Criticality: { High: 1.0, Mid: 0, Low: 0 },
        Level: { FLEET: 0.1, SHIP: 0.9, EQUIPMENT: 0.2 },
        Action: { EVALUTE: 0.1, IDENTIFY: 0.8, SELECT_K_OUT_OF_N: 0.1 },
        Entity: { EQUIPMENT: 0.1, SHIP: 0.9, WORKSHOP: 0 },
        TaskObjective: {
          Gunfiring: 0.1,
          InterrogationInterception: 0.1,
          MaintenanceScheduling: 0,
          Miscellaneous: 0,
          MissileFiring: 0.9,
          SearchAndRescue: 0,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0,
          BALANCING_LOADS: 1.0,
          CAPABILITY: 0.2,
          CONFORMANCE: 0,
          ENDURANCE: 0.2,
          FLEET_AVAILABILITY: 0.2,
          FUEL: 0.2,
          LOGISTIC_TIME: 0.1,
          MANPOWER_AVAILABILITY: 0.4,
          RATION: 0,
          RELIABILITY: 0.5,
          RISK_SCORE: 1.0,
          SHIP_CLASS: 0.1,
          SPARES_AVAILABILITY: 0.2,
          SPEED: 0.3,
          WORKING_HOURS: 0.2,
          WORKSHOP_AVAILABILITY: 0,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0.2,
          MAXIMUM_AVAILABILITY: 0.7,
          MAXIMUM_CONFORMANCE: 0,
          MAXIMUM_RELIABILITY: 0.3,
          MINIMUM_COST: 0,
          MINIMUM_DOWNTIME: 0.1,
          MINIMUM_RISK: 0.4,
        },
      },
    },
  },

  {
    id: "exercise_arabian",
    label: "Exercise – Submerged Contact (Arabian Sea)",
    scenario:
      "At 0855 hours, a naval vessel was conducting an exercise mission in the Arabian Sea, approximately 200 nautical miles off the Goa coast. During this mission, an unidentified submerged contact was detected at a distance of 12 nautical miles, bearing 330°. The contact subsequently surfaced and began moving toward the vessel at a speed of 15 knots. Complicating matters, the vessel's towed-array sonar system malfunctioned, significantly reducing its ability to detect or classify other potential threats in the area. The crew estimated that repairs to the sonar system could take up to four hours, leaving the vessel vulnerable during this period. Overcast skies and heavy rainfall further reduced visibility, making it critical to identify the contact while ensuring both the reliability and availability of the vessel's systems. The combination of these factors created a challenging operational environment that required careful management.",
    dependability: {
      system_dependability: 0.750718505988628,
      equipment_dependability: [0.739496313747589, 0.708115972609369, 0.818549922007087],
      phases: { harbour: 0.83, cruise: 0.76, action: 0.66 },
    },
    explanation:
      "Category is split close to evenly between Mission and Maintenance because the scenario blends two threads: an exercise mission with an unidentified contact, and a genuine equipment fault in the towed-array sonar. SubMission favors Exercise since that is the stated mission type. TaskObjective is dominated by InterrogationInterception rather than SearchAndRescue, because the core task is identifying the submerged-then-surfaced contact, not conducting a rescue — with MaintenanceScheduling staying elevated in second place to reflect the sonar repair thread running in parallel. Action and Entity again resolve to IDENTIFY and SHIP for the same reason. Among constraints, RELIABILITY and RISK_SCORE dominate rather than FLEET_AVAILABILITY, since the sonar malfunction is framed as a reliability problem that increases risk, and WORKING_HOURS is moderately elevated to reflect the estimated four-hour repair window. ObjectiveFunction still favors MAXIMUM_AVAILABILITY, but with a higher-than-usual share going to MAXIMUM_RELIABILITY, capturing the dual concern the text raises around both reliability and availability of the vessel's systems.",
    predictions: {
      predclass_output: {
        Category: { Maintenance: 0.42, Mission: 0.58 },
        SubMission: {
          Combat: 0.12,
          Exercise: 0.62,
          Fleetsupport: 0.08,
          Sortie: 0.05,
          Miscellaneous: 0.05,
          Humanitarian: 0.08,
        },
        Criticality: { High: 0.78, Mid: 0.14, Low: 0.08 },
        Level: { FLEET: 0.1, SHIP: 0.65, EQUIPMENT: 0.25 },
        Action: { EVALUTE: 0.12, IDENTIFY: 0.68, SELECT_K_OUT_OF_N: 0.2 },
        Entity: { EQUIPMENT: 0.22, SHIP: 0.7, WORKSHOP: 0.08 },
        TaskObjective: {
          Gunfiring: 0.03,
          InterrogationInterception: 0.55,
          MaintenanceScheduling: 0.27,
          Miscellaneous: 0.02,
          MissileFiring: 0.02,
          SearchAndRescue: 0.11,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0.02,
          BALANCING_LOADS: 0.18,
          CAPABILITY: 0.08,
          CONFORMANCE: 0.04,
          ENDURANCE: 0.12,
          FLEET_AVAILABILITY: 0.15,
          FUEL: 0.08,
          LOGISTIC_TIME: 0.06,
          MANPOWER_AVAILABILITY: 0.1,
          RATION: 0.04,
          RELIABILITY: 0.72,
          RISK_SCORE: 0.65,
          SHIP_CLASS: 0.04,
          SPARES_AVAILABILITY: 0.18,
          SPEED: 0.08,
          WORKING_HOURS: 0.45,
          WORKSHOP_AVAILABILITY: 0.08,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0.08,
          MAXIMUM_AVAILABILITY: 0.68,
          MAXIMUM_CONFORMANCE: 0.02,
          MAXIMUM_RELIABILITY: 0.14,
          MINIMUM_COST: 0.02,
          MINIMUM_DOWNTIME: 0.04,
          MINIMUM_RISK: 0.02,
        },
      },
      LFapplier_output: {
        Category: { Maintenance: 0.4, Mission: 0.6 },
        SubMission: { Combat: 0.1, Exercise: 0.8, Fleetsupport: 0.1, Sortie: 0, Miscellaneous: 0, Humanitarian: 0 },
        Criticality: { High: 0.8, Mid: 0.2, Low: 0 },
        Level: { FLEET: 0.1, SHIP: 0.7, EQUIPMENT: 0.5 },
        Action: { EVALUTE: 0.2, IDENTIFY: 0.7, SELECT_K_OUT_OF_N: 0.1 },
        Entity: { EQUIPMENT: 0.3, SHIP: 0.7, WORKSHOP: 0.1 },
        TaskObjective: {
          Gunfiring: 0,
          InterrogationInterception: 0.6,
          MaintenanceScheduling: 0.3,
          Miscellaneous: 0,
          MissileFiring: 0,
          SearchAndRescue: 0.1,
        },
        Constraints: {
          ACTIVITY_SEQUENCES: 0,
          BALANCING_LOADS: 0.3,
          CAPABILITY: 0.4,
          CONFORMANCE: 0.2,
          ENDURANCE: 0.3,
          FLEET_AVAILABILITY: 0.4,
          FUEL: 0.2,
          LOGISTIC_TIME: 0.2,
          MANPOWER_AVAILABILITY: 0.3,
          RATION: 0.1,
          RELIABILITY: 1.0,
          RISK_SCORE: 0.8,
          SHIP_CLASS: 0.2,
          SPARES_AVAILABILITY: 0.6,
          SPEED: 0.2,
          WORKING_HOURS: 0.7,
          WORKSHOP_AVAILABILITY: 0.5,
        },
        ObjectiveFunction: {
          MINIMUM_TIME: 0.1,
          MAXIMUM_AVAILABILITY: 0.7,
          MAXIMUM_CONFORMANCE: 0.1,
          MAXIMUM_RELIABILITY: 0.6,
          MINIMUM_COST: 0.1,
          MINIMUM_DOWNTIME: 0.2,
          MINIMUM_RISK: 0.1,
        },
      },
    },
  },
];

export const SHIP_DEPENDABILITY: Record<string, ShipDependabilityEntry> = {
  KOLKATA: {
    displayName: 'INS Kolkata',
    system_dependability: 0.91,
    phases: { harbour: 0.95, cruise: 0.91, action: 0.86 },
    scenarioId: 'shivalik_drone',
    subsystems: [
      { name: 'Main Propulsion (Gas Turbine)', score: 0.97 },
      { name: 'Power Distribution Grid', score: 0.94 },
      { name: 'Combat Management Suite (CMS)', score: 0.92 },
      { name: 'Auxiliary Cooling Assemblies', score: 0.78 },
      { name: 'Integrated Air Defence Radar', score: 0.90 },
    ],
  },
  CHENNAI: {
    displayName: 'INS Chennai',
    system_dependability: 0.77,
    phases: { harbour: 0.82, cruise: 0.77, action: 0.70 },
    scenarioId: 'exercise_arabian',
    subsystems: [
      { name: 'Main Propulsion (Gas Turbine)', score: 0.87 },
      { name: 'Power Distribution Grid', score: 0.83 },
      { name: 'Combat Management Suite (CMS)', score: 0.78 },
      { name: 'Auxiliary Cooling Assemblies', score: 0.59 },
      { name: 'Integrated Air Defence Radar', score: 0.70 },
    ],
  },
  TUSHIL: {
    displayName: 'INS Tushil',
    system_dependability: 0.89,
    phases: { harbour: 0.94, cruise: 0.89, action: 0.83 },
    scenarioId: 'talwar_humanitarian',
    subsystems: [
      { name: 'Main Propulsion (Gas Turbine)', score: 0.95 },
      { name: 'Power Distribution Grid', score: 0.91 },
      { name: 'Combat Management Suite (CMS)', score: 0.89 },
      { name: 'Auxiliary Cooling Assemblies', score: 0.74 },
      { name: 'Integrated Air Defence Radar', score: 0.86 },
    ],
  },
  TABAR: {
    displayName: 'INS Tabar',
    system_dependability: 0.71,
    phases: { harbour: 0.76, cruise: 0.71, action: 0.64 },
    scenarioId: 'talwar_humanitarian',
    subsystems: [
      { name: 'Main Propulsion (Gas Turbine)', score: 0.82 },
      { name: 'Power Distribution Grid', score: 0.78 },
      { name: 'Combat Management Suite (CMS)', score: 0.73 },
      { name: 'Auxiliary Cooling Assemblies', score: 0.54 },
      { name: 'Integrated Air Defence Radar', score: 0.65 },
    ],
  },
  SARYU: {
    displayName: 'INS Saryu',
    system_dependability: 0.68,
    phases: { harbour: 0.74, cruise: 0.68, action: 0.60 },
    scenarioId: 'destroyer_sar',
    subsystems: [
      { name: 'Main Propulsion (Gas Turbine)', score: 0.79 },
      { name: 'Power Distribution Grid', score: 0.75 },
      { name: 'Combat Management Suite (CMS)', score: 0.68 },
      { name: 'Auxiliary Cooling Assemblies', score: 0.51 },
      { name: 'Integrated Air Defence Radar', score: 0.60 },
    ],
  },
  IMPHAL: {
    displayName: 'INS Imphal',
    system_dependability: 0.83,
    phases: { harbour: 0.96, cruise: 0.93, action: 0.88 },
    scenarioId: 'shivalik_sonar',
    subsystems: [
      { name: 'Main Propulsion (Gas Turbine)', score: 0.98 },
      { name: 'Power Distribution Grid', score: 0.95 },
      { name: 'Combat Management Suite (CMS)', score: 0.94 },
      { name: 'Auxiliary Cooling Assemblies', score: 0.81 },
      { name: 'Integrated Air Defence Radar', score: 0.92 },
    ],
  },
  VISAKHAPATNAM: {
    displayName: 'INS Visakhapatnam',
    system_dependability: 0.83,
    phases: { harbour: 0.88, cruise: 0.83, action: 0.77 },
    scenarioId: 'destroyer_sar',
    subsystems: [
      { name: 'Main Propulsion (Gas Turbine)', score: 0.92 },
      { name: 'Power Distribution Grid', score: 0.88 },
      { name: 'Combat Management Suite (CMS)', score: 0.85 },
      { name: 'Auxiliary Cooling Assemblies', score: 0.68 },
      { name: 'Integrated Air Defence Radar', score: 0.79 },
    ],
  },
  TAMAL: {
    displayName: 'INS Tamal',
    system_dependability: 0.85,
    phases: { harbour: 0.90, cruise: 0.85, action: 0.79 },
    scenarioId: 'shivalik_drone',
    subsystems: [
      { name: 'Main Propulsion (Gas Turbine)', score: 0.93 },
      { name: 'Power Distribution Grid', score: 0.89 },
      { name: 'Combat Management Suite (CMS)', score: 0.86 },
      { name: 'Auxiliary Cooling Assemblies', score: 0.71 },
      { name: 'Integrated Air Defence Radar', score: 0.82 },
    ],
  },
};

export function resolveShipDependability(shipName: string): ShipDependabilityEntry | undefined {
  const norm = shipName.toUpperCase().replace(/^INS\s+/i, '').trim();
  if (SHIP_DEPENDABILITY[norm]) return SHIP_DEPENDABILITY[norm];
  const key = Object.keys(SHIP_DEPENDABILITY).find((k) => norm.includes(k) || k.includes(norm));
  return key ? SHIP_DEPENDABILITY[key] : undefined;
}
export default DEMO_SCENARIOS;