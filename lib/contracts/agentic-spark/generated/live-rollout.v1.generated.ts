// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/live-rollout/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "deployment-stage.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/live-rollout/v1/deployment-stage.schema.json",
    "title": "deployment_stage_record_v1",
    "description": "One observation of a live-deployment rollout (FAZ-00 P00-08): a single component's change moves through expand -> compatibility -> backfill -> contract. An engine_worker contract-stage record retiring a renderer/impl revision applies P00-04's K256 gate (contracts/agentic-spark/composition-project/v1/renderer-repin.schema.json + schema-evolution-rules.json, PR #305: 'P00-08 owns expand/contract, mixed-version workers, old client / new API and rollback'). Q102: no legacy user-data migration is in scope; this record only describes live version/compatibility rollout of a component change, never a data-migration-from-legacy-storage step.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "change_id",
      "component",
      "stage",
      "occurred_at",
      "from_artifact_version",
      "to_artifact_version",
      "additive_only",
      "rollback_safe",
      "requires_old_client_support",
      "old_consumer_share_percent",
      "requires_parity_report",
      "source_evidence"
    ],
    "properties": {
      "schema_version": {
        "const": "deployment_stage_record_v1"
      },
      "change_id": {
        "description": "Opaque slug identifying one rollout change of one component (e.g. add_composition_projects_table, retire_render_impl_v3). Groups the gap-free expand->compatibility->backfill->contract chain for that change.",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{2,63}$"
      },
      "component": {
        "description": "gateway = api-gateway (k8s/apps/api-gateway/base/web/deployment.yaml). engine_api = workflow-engine API (k8s/apps/workflow-engine/base/api-deployment.yaml). engine_worker = workflow-engine Temporal worker fleet (k8s/apps/workflow-engine/base/worker-deployments.yaml, one Deployment per WORKER_QUEUE). ui = youtorch-ui.",
        "enum": [
          "gateway",
          "engine_api",
          "engine_worker",
          "ui"
        ]
      },
      "stage": {
        "enum": [
          "expand",
          "compatibility",
          "backfill",
          "contract"
        ]
      },
      "occurred_at": {
        "type": "string",
        "format": "date-time"
      },
      "from_artifact_version": {
        "description": "Deployed artifact identity (git SHA or image tag) this stage record starts from. At a contract-stage engine_worker record this is the worker revision being retired.",
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"
      },
      "to_artifact_version": {
        "description": "Deployed artifact identity this stage record moves to.",
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"
      },
      "additive_only": {
        "type": "boolean"
      },
      "rollback_safe": {
        "description": "True iff reverting to from_artifact_version after this stage loses no data and breaks no in-flight consumer.",
        "type": "boolean"
      },
      "requires_old_client_support": {
        "type": "boolean"
      },
      "old_consumer_share_percent": {
        "type": "number",
        "minimum": 0,
        "maximum": 100
      },
      "requires_parity_report": {
        "type": "boolean"
      },
      "parity_report_ref": {
        "description": "K256 gate: mirrors P00-04 renderer_repin_v1.parity_report.report_id (contracts/agentic-spark/composition-project/v1/renderer-repin.schema.json, PR #305) -- the passed parity report under the shared QC profile. Only present on an engine_worker contract-stage record.",
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "renderer_repin_ref": {
        "description": "K256 gate: mirrors P00-04 renderer_repin_v1.repin_id (same package) for the applied re-pin (status=applied) that moved a project off the renderer revision being retired. Prose reference, not a cross-package $ref (Wave 0 rule).",
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "pinning_projects_remaining": {
        "description": "K256 gate: count of Composition projects still pinning the from_artifact_version renderer revision without an applied renderer_repin_v1 (P00-04 schema-evolution-rules.json retire_requires). Must be 0 before the revision leaves the live worker fleet.",
        "type": "integer",
        "minimum": 0
      },
      "source_evidence": {
        "description": "K IDs and/or file:line real-code references grounding this record.",
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "notes": {
        "type": "string"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "stage": {
              "const": "expand"
            }
          },
          "required": [
            "stage"
          ]
        },
        "then": {
          "properties": {
            "additive_only": {
              "const": true
            },
            "rollback_safe": {
              "const": true
            },
            "requires_old_client_support": {
              "const": true
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "stage": {
              "const": "compatibility"
            }
          },
          "required": [
            "stage"
          ]
        },
        "then": {
          "properties": {
            "requires_old_client_support": {
              "const": true
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "stage": {
              "const": "backfill"
            }
          },
          "required": [
            "stage"
          ]
        },
        "then": {
          "properties": {
            "requires_old_client_support": {
              "const": true
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "stage": {
              "const": "contract"
            }
          },
          "required": [
            "stage"
          ]
        },
        "then": {
          "properties": {
            "old_consumer_share_percent": {
              "const": 0
            },
            "requires_old_client_support": {
              "const": false
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "stage": {
              "const": "contract"
            },
            "component": {
              "const": "engine_worker"
            }
          },
          "required": [
            "stage",
            "component"
          ]
        },
        "then": {
          "required": [
            "parity_report_ref",
            "renderer_repin_ref",
            "pinning_projects_remaining"
          ],
          "properties": {
            "requires_parity_report": {
              "const": true
            },
            "pinning_projects_remaining": {
              "const": 0
            }
          }
        },
        "else": {
          "properties": {
            "requires_parity_report": {
              "const": false
            }
          },
          "not": {
            "anyOf": [
              {
                "required": [
                  "parity_report_ref"
                ]
              },
              {
                "required": [
                  "renderer_repin_ref"
                ]
              },
              {
                "required": [
                  "pinning_projects_remaining"
                ]
              }
            ]
          }
        }
      }
    ]
  },
  "version-compatibility-pair.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/live-rollout/v1/version-compatibility-pair.schema.json",
    "title": "version_compatibility_pair_record_v1",
    "description": "One edge of the live gateway/engine/UI version-compatibility matrix (FAZ-00 P00-08): whether component_a_version and component_b_version may run at the same time during a rolling deploy, and which compat mapper(s) make that true.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "pair_id",
      "component_a",
      "component_a_version",
      "component_b",
      "component_b_version",
      "compat_mode",
      "required_compat_mappers",
      "reason",
      "source_evidence"
    ],
    "properties": {
      "schema_version": {
        "const": "version_compatibility_pair_v1"
      },
      "pair_id": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{2,63}$"
      },
      "component_a": {
        "$ref": "#/$defs/component"
      },
      "component_b": {
        "$ref": "#/$defs/component"
      },
      "component_a_version": {
        "description": "Exact artifact version, or '*' meaning any version of component_a is covered by this edge.",
        "type": "string",
        "pattern": "^(\\*|[A-Za-z0-9][A-Za-z0-9._-]{0,63})$"
      },
      "component_b_version": {
        "type": "string",
        "pattern": "^(\\*|[A-Za-z0-9][A-Za-z0-9._-]{0,63})$"
      },
      "compat_mode": {
        "description": "full = both read/write the current contract identically. legacy_read_only = the older side can still be read/served via a compat mapper but never gains the newer capability. blocked = must not coexist; the rollout plan must not allow this pair to serve traffic at the same time.",
        "enum": [
          "full",
          "legacy_read_only",
          "blocked"
        ]
      },
      "required_compat_mappers": {
        "description": "Named compat mappers this edge depends on. Values reference concrete Wave 0 packages in prose (no cross-package $ref before Wave 0 acceptance): content_json_compat_mapper_v1 and canonical_field_dictionary_v1 are owned by P00-03 (contracts/agentic-spark/assistant-runtime/v1/content-json-compat.json, field-dictionary.json); composition_schema_version_upcaster is owned by P00-04 (K256).",
        "type": "array",
        "items": {
          "enum": [
            "content_json_compat_mapper_v1",
            "canonical_field_dictionary_v1",
            "composition_schema_version_upcaster"
          ]
        },
        "uniqueItems": true
      },
      "reason": {
        "type": "string",
        "minLength": 1
      },
      "source_evidence": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "compat_mode": {
              "const": "blocked"
            }
          },
          "required": [
            "compat_mode"
          ]
        },
        "then": {
          "properties": {
            "required_compat_mappers": {
              "maxItems": 0
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "compat_mode": {
              "const": "legacy_read_only"
            }
          },
          "required": [
            "compat_mode"
          ]
        },
        "then": {
          "properties": {
            "required_compat_mappers": {
              "minItems": 1
            }
          }
        }
      }
    ],
    "$defs": {
      "component": {
        "enum": [
          "gateway",
          "engine_api",
          "engine_worker",
          "ui"
        ]
      }
    }
  },
  "worker-revision-capability.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/live-rollout/v1/worker-revision-capability.schema.json",
    "title": "worker_revision_capability_record_v1",
    "description": "What one deployed workflow-engine worker revision, on one Temporal task_queue, can execute during a mixed-version rollout window (FAZ-00 P00-08). node_type and satisfies_impl_revisions mirror the execution-pin (P00-09) node_impl_pins shape field-for-field (workflow-engine/app/node_impl.py NodeImplPin.type / impl_revision), not a cross-package $ref (Wave 0 rule).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "task_queue",
      "worker_deployment_revision",
      "node_type",
      "satisfies_impl_revisions",
      "traffic_state",
      "source_evidence"
    ],
    "properties": {
      "schema_version": {
        "const": "worker_revision_capability_record_v1"
      },
      "task_queue": {
        "description": "Real WORKER_QUEUE values are p0-/p1- prefixed or q-prefixed (k8s/apps/workflow-engine/base/worker-deployments.yaml), e.g. p1-basic, q-video-generate.",
        "type": "string",
        "pattern": "^(p[01]-[a-z0-9-]+|q-[a-z0-9-]+)$"
      },
      "worker_deployment_revision": {
        "description": "Deployed worker image tag/digest identity for this Deployment's current rollout.",
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"
      },
      "node_type": {
        "description": "Same pattern as execution-pin NodeImplPin.type (node_type@version).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*)*@\\d+$"
      },
      "satisfies_impl_revisions": {
        "description": "impl_revision integers (execution-pin NodeImplPin.impl_revision, minimum 1) this worker revision can execute for node_type on task_queue.",
        "type": "array",
        "minItems": 1,
        "uniqueItems": true,
        "items": {
          "type": "integer",
          "minimum": 1
        }
      },
      "traffic_state": {
        "description": "rolling_in/steady/rolling_out = live (may receive tasks from task_queue). retired = no longer deployed; only a historical record kept for the K256 retirement audit trail.",
        "enum": [
          "rolling_in",
          "steady",
          "rolling_out",
          "retired"
        ]
      },
      "source_evidence": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["deployment-stage", "version-compatibility-pair", "worker-revision-capability"] as const;
export type DocumentType = "deployment-stage" | "version-compatibility-pair" | "worker-revision-capability";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "deployment-stage": [
    "deployment_stage_record_v1"
  ],
  "version-compatibility-pair": [
    "version_compatibility_pair_v1"
  ],
  "worker-revision-capability": [
    "worker_revision_capability_record_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type DeploymentStage = {
    readonly "schema_version": "deployment_stage_record_v1";
    readonly "change_id": string;
    readonly "component": "gateway" | "engine_api" | "engine_worker" | "ui";
    readonly "stage": "expand" | "compatibility" | "backfill" | "contract";
    readonly "occurred_at": string;
    readonly "from_artifact_version": string;
    readonly "to_artifact_version": string;
    readonly "additive_only": boolean;
    readonly "rollback_safe": boolean;
    readonly "requires_old_client_support": boolean;
    readonly "old_consumer_share_percent": number;
    readonly "requires_parity_report": boolean;
    readonly "parity_report_ref"?: string;
    readonly "renderer_repin_ref"?: string;
    readonly "pinning_projects_remaining"?: number;
    readonly "source_evidence": readonly (string)[];
    readonly "notes"?: string;
  };
export type VersionCompatibilityPair = {
    readonly "schema_version": "version_compatibility_pair_v1";
    readonly "pair_id": string;
    readonly "component_a": "gateway" | "engine_api" | "engine_worker" | "ui";
    readonly "component_b": "gateway" | "engine_api" | "engine_worker" | "ui";
    readonly "component_a_version": string;
    readonly "component_b_version": string;
    readonly "compat_mode": "full" | "legacy_read_only" | "blocked";
    readonly "required_compat_mappers": readonly ("content_json_compat_mapper_v1" | "canonical_field_dictionary_v1" | "composition_schema_version_upcaster")[];
    readonly "reason": string;
    readonly "source_evidence": readonly (string)[];
  };
export type WorkerRevisionCapability = {
    readonly "schema_version": "worker_revision_capability_record_v1";
    readonly "task_queue": string;
    readonly "worker_deployment_revision": string;
    readonly "node_type": string;
    readonly "satisfies_impl_revisions": readonly (number)[];
    readonly "traffic_state": "rolling_in" | "steady" | "rolling_out" | "retired";
    readonly "source_evidence": readonly (string)[];
  };

export const reader = new ContractPackageReader({
  package: "live-rollout",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
