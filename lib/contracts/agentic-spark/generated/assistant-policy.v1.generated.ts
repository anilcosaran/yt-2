// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/assistant-policy/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "assumption-record.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/assumption-record.schema.json",
    "title": "assumption_record_v1",
    "description": "One entry of the job's visible 'Varsay\u0131mlar\u0131m' list (Y1 \u00a71.4, VIDEO 12C, K334): a decision the agent made instead of asking. Always reversible: reverting runs an A-lane undo group or an in-place replan (12B). A default taken because the question budget was spent is also recorded here.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "assumption_id",
      "job_id",
      "run_id",
      "stage",
      "field_key",
      "reason_kind",
      "chosen",
      "alternatives",
      "rationale",
      "cost_effect",
      "revert_target",
      "decided_by",
      "mode_at_decision",
      "status",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "assumption_record_v1"
      },
      "assumption_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "run_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "stage": {
        "$ref": "common.schema.json#/$defs/StageKey"
      },
      "field_key": {
        "$ref": "common.schema.json#/$defs/FieldKey"
      },
      "reason_kind": {
        "description": "two_reasonable_options: B-level ambiguity answered by the agent; candidate_selection: most likely candidate above the confidence threshold; question_budget_default: ledger refused a question; optional_item_omitted: optional item left out and reported (K295).",
        "enum": [
          "two_reasonable_options",
          "candidate_selection",
          "question_budget_default",
          "optional_item_omitted"
        ]
      },
      "confidence": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      },
      "chosen": {
        "$ref": "#/$defs/Choice"
      },
      "alternatives": {
        "description": "Other options that were available; chosen + alternatives never exceed the 4-option question limit.",
        "type": "array",
        "maxItems": 3,
        "items": {
          "$ref": "#/$defs/Choice"
        }
      },
      "rationale": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "cost_effect": {
        "$ref": "#/$defs/CostEffect"
      },
      "revert_target": {
        "$ref": "#/$defs/RevertTarget"
      },
      "decided_by": {
        "const": "agent"
      },
      "mode_at_decision": {
        "$ref": "common.schema.json#/$defs/Mode"
      },
      "status": {
        "enum": [
          "active",
          "reverted",
          "superseded"
        ]
      },
      "reverted_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "reason_kind": {
              "const": "candidate_selection"
            }
          }
        },
        "then": {
          "required": [
            "confidence"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "reverted"
            }
          }
        },
        "then": {
          "required": [
            "reverted_at"
          ]
        },
        "else": {
          "not": {
            "required": [
              "reverted_at"
            ]
          }
        }
      }
    ],
    "$defs": {
      "Choice": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "value",
          "label"
        ],
        "properties": {
          "value": {
            "$ref": "common.schema.json#/$defs/ScalarValue"
          },
          "label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          },
          "thumbnail": {
            "$ref": "common.schema.json#/$defs/StorageThumbnailRef"
          }
        }
      },
      "CostEffect": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind"
            ],
            "properties": {
              "kind": {
                "const": "none"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "delta_credits",
              "estimate_revision"
            ],
            "properties": {
              "kind": {
                "const": "estimate_delta"
              },
              "delta_credits": {
                "$ref": "common.schema.json#/$defs/CreditDelta"
              },
              "estimate_revision": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              }
            }
          }
        ]
      },
      "RevertTarget": {
        "description": "How 'Geri al' is executed: an A-lane undo group, or an in-place replan of the plan revision (VIDEO 12B).",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "undo_group_id"
            ],
            "properties": {
              "kind": {
                "const": "undo_group"
              },
              "undo_group_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "production_plan_revision"
            ],
            "properties": {
              "kind": {
                "const": "replan"
              },
              "production_plan_revision": {
                "$ref": "common.schema.json#/$defs/Revision"
              }
            }
          }
        ]
      }
    }
  },
  "async-operation-ref.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/async-operation-ref.schema.json",
    "title": "async_operation_ref_v1",
    "description": "Operation reference returned immediately when a lane D (Workflow/Temporal) tool call is accepted (Y4, GSAP \u00a79). The run keeps working; waiting happens only at the join point. Completion wakes the run by push (runtime-events \u2192 NOTIFY); polling is fallback only. A new user message never cancels the operation; cancel is an explicit command.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "operation_ref_id",
      "job_id",
      "run_id",
      "tool_invocation_id",
      "logical_operation_id",
      "owner_bc",
      "owner_operation_id",
      "lane",
      "join_point_id",
      "wake_mode",
      "cancel_on_new_message",
      "accepted_at"
    ],
    "properties": {
      "schema_version": {
        "const": "async_operation_ref_v1"
      },
      "operation_ref_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "run_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tool_invocation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "logical_operation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "owner_bc": {
        "$ref": "common.schema.json#/$defs/OwnerBc"
      },
      "owner_operation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "lane": {
        "description": "Only lane D returns an operation ref; lanes A/B/C answer synchronously.",
        "const": "D"
      },
      "join_point_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "wake_mode": {
        "const": "push_with_fallback_poll"
      },
      "cancel_on_new_message": {
        "const": false
      },
      "accepted_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/common.schema.json",
    "title": "assistant_policy_common_v1",
    "description": "Shared definitions of the assistant-policy v1 package. Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "Sha256": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Version": {
        "type": "integer",
        "minimum": 0
      },
      "Revision": {
        "type": "integer",
        "minimum": 1
      },
      "FieldKey": {
        "description": "Stable key of the decided or requested field (one key per question).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,63}$"
      },
      "StageKey": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,63}$"
      },
      "Mode": {
        "description": "Canonical execution mode (Q24/Q74). Legacy approval_mode values are normalized by the P00-03 field dictionary; the effective mode is the P00-11 job settings snapshot.",
        "enum": [
          "ask",
          "auto",
          "auto_full"
        ]
      },
      "ScalarValue": {
        "oneOf": [
          {
            "type": "string",
            "maxLength": 2000
          },
          {
            "type": "number"
          },
          {
            "type": "boolean"
          },
          {
            "type": "null"
          }
        ]
      },
      "CreditDelta": {
        "description": "Signed credit amount on the Billing CreditAmount boundary (0.0001). Compare as decimals.",
        "type": "number",
        "multipleOf": 0.0001
      },
      "StorageThumbnailRef": {
        "description": "Storage object + checksum of a small preview image (owner: Storage).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "storage_object_id": {
            "$ref": "#/$defs/OpaqueId"
          },
          "checksum_sha256": {
            "$ref": "#/$defs/Sha256"
          }
        }
      },
      "OwnerBc": {
        "enum": [
          "workflow",
          "composition",
          "storage",
          "connector",
          "provider"
        ]
      }
    }
  },
  "continuation-batch.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/continuation-batch.schema.json",
    "title": "continuation_batch_v1",
    "description": "One coalesced continuation call for operations of ONE run that completed within the coalescing window (Y4; TK-36: operations of different runs/jobs are never merged, so cost and context never mix). Items carry no run of their own: the batch run_id is the only run, and the runtime verifies every operation belongs to it.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "continuation_id",
      "job_id",
      "run_id",
      "join_point_id",
      "items",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "continuation_batch_v1"
      },
      "continuation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "run_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "join_point_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "items": {
        "type": "array",
        "minItems": 1,
        "maxItems": 16,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "operation_ref_id",
            "tool_result_id",
            "completed_at"
          ],
          "properties": {
            "operation_ref_id": {
              "$ref": "common.schema.json#/$defs/OpaqueId"
            },
            "tool_result_id": {
              "description": "P00-03 tool_result_v1 recorded for the completion (observation that enters the canonical context).",
              "$ref": "common.schema.json#/$defs/OpaqueId"
            },
            "completed_at": {
              "$ref": "common.schema.json#/$defs/Timestamp"
            }
          }
        }
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "external-action-grant.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/external-action-grant.schema.json",
    "title": "external_action_grant_v1",
    "description": "'Bu hesap + ara\u00e7 revision'\u0131 i\u00e7in hep izin ver' (Q75). Created only from a canonical Review decision in which the user chose the always-allow option for an external or irreversible action (send, publish, share, permanent delete, external spend, external write). It applies to this user, this connected account and this exact tool revision only; a new tool revision asks again. Credentials, OAuth scopes and spend stay with Connector and Billing; the grant never widens them. An external_spend grant must carry max_commitment and applies only while the Connector ads external-spend gate (P01C-16, C01) is open (mode-table.json external_action_grant_rules).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "grant_id",
      "tenant_id",
      "user_id",
      "connection",
      "tool",
      "effect_kinds",
      "scope",
      "max_commitment",
      "source_decision",
      "granted_at",
      "revoked_at"
    ],
    "properties": {
      "schema_version": {
        "const": "external_action_grant_v1"
      },
      "grant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "user_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "connection": {
        "$ref": "#/$defs/ConnectionRef"
      },
      "tool": {
        "$ref": "#/$defs/ToolRef"
      },
      "effect_kinds": {
        "type": "array",
        "minItems": 1,
        "maxItems": 6,
        "uniqueItems": true,
        "items": {
          "enum": [
            "send",
            "publish",
            "share",
            "permanent_delete",
            "external_spend",
            "external_write"
          ]
        }
      },
      "scope": {
        "const": "account_and_tool_revision"
      },
      "max_commitment": {
        "description": "Required for external_spend, null otherwise.",
        "oneOf": [
          {
            "$ref": "#/$defs/MaxCommitment"
          },
          {
            "type": "null"
          }
        ]
      },
      "source_decision": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "review_request_id",
          "decision_version"
        ],
        "properties": {
          "review_request_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "decision_version": {
            "$ref": "common.schema.json#/$defs/Revision"
          }
        }
      },
      "granted_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "revoked_at": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "effect_kinds": {
              "contains": {
                "const": "external_spend"
              }
            }
          },
          "required": [
            "effect_kinds"
          ]
        },
        "then": {
          "properties": {
            "max_commitment": {
              "$ref": "#/$defs/MaxCommitment"
            }
          }
        },
        "else": {
          "properties": {
            "max_commitment": {
              "type": "null"
            }
          }
        }
      }
    ],
    "$defs": {
      "MaxCommitment": {
        "description": "Upper bound of external (provider) spend the grant allows for one period, in the connected account's currency minor units (no default currency, no silent FX; OAUTH-VE-NATIVE-ADAPTERLER \u00a75).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "amount_minor",
          "currency",
          "period"
        ],
        "properties": {
          "amount_minor": {
            "type": "integer",
            "minimum": 1
          },
          "currency": {
            "type": "string",
            "pattern": "^[A-Z]{3}$"
          },
          "period": {
            "enum": [
              "per_action",
              "day",
              "month",
              "campaign_lifetime"
            ]
          }
        }
      },
      "ConnectionRef": {
        "description": "Connected account (P00-03 ConnectedAccountRef / P01C-24 own the full ref); secret-free.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "connector_definition_id",
          "connection_id"
        ],
        "properties": {
          "connector_definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "connection_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "ToolRef": {
        "description": "Exact Connector tool revision (P00-03 ConnectorToolRef / P01C-24).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "connector_definition_id",
          "tool_name",
          "tool_revision_id"
        ],
        "properties": {
          "connector_definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_name": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_-]*(\\.[a-z][a-z0-9_-]*)+$",
            "maxLength": 128
          },
          "tool_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      }
    }
  },
  "full-access-consent.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/full-access-consent.schema.json",
    "title": "full_access_consent_v1",
    "description": "One-time warning consent shown the first time a user turns on Tam eri\u015fim (auto_full, Q74 mode table). One record per user and warning revision; a new warning text revision asks again. It is not a spend grant: amounts stay with P00-10.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "consent_id",
      "tenant_id",
      "user_id",
      "scope",
      "warning_revision",
      "shown_at",
      "accepted_at"
    ],
    "properties": {
      "schema_version": {
        "const": "full_access_consent_v1"
      },
      "consent_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "user_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "scope": {
        "const": "user_first_activation"
      },
      "warning_revision": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "shown_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "accepted_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "join-point.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/join-point.schema.json",
    "title": "join_point_v1",
    "description": "Where a run waits for one or more of its pending operations (Y4: a run may hold several pending operations and one join point). Steps that do not depend on the awaited operations continue meanwhile inside the same job and its current authorization phase (F31/TK-17); they never open a new spend authorization.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "join_point_id",
      "job_id",
      "run_id",
      "awaited_operation_ref_ids",
      "join_mode",
      "independent_step_ids",
      "independent_steps_budget_scope",
      "state",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "join_point_v1"
      },
      "join_point_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "run_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "awaited_operation_ref_ids": {
        "type": "array",
        "minItems": 1,
        "maxItems": 16,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/OpaqueId"
        }
      },
      "join_mode": {
        "description": "all: continue when every awaited operation is terminal; any: continue at the first terminal one.",
        "enum": [
          "all",
          "any"
        ]
      },
      "independent_step_ids": {
        "type": "array",
        "maxItems": 32,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/OpaqueId"
        }
      },
      "independent_steps_budget_scope": {
        "const": "same_job_current_authorization"
      },
      "state": {
        "enum": [
          "waiting",
          "ready",
          "resumed",
          "canceled"
        ]
      },
      "continuation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "state": {
              "const": "resumed"
            }
          }
        },
        "then": {
          "required": [
            "continuation_id"
          ]
        }
      }
    ]
  },
  "mode-setting-proposal.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/mode-setting-proposal.schema.json",
    "title": "mode_setting_proposal_v1",
    "description": "Q74: 'Bana onay sorma' is not stored as a free-text rule. The agent proposes the saved setting that switches the mode to auto_full (one tap, reversible). Accepting sends the P00-11 settings command (selected_job_and_future or future_jobs_only, with its CAS versions) and requires the auto_full first-activation consent.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "proposal_id",
      "conversation_id",
      "trigger_message_id",
      "detected_intent",
      "proposed_mode",
      "proposed_scope",
      "requires_user_action",
      "reversible",
      "creates_free_text_rule",
      "status",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "mode_setting_proposal_v1"
      },
      "proposal_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "trigger_message_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "detected_intent": {
        "const": "stop_asking_for_approval"
      },
      "proposed_mode": {
        "const": "auto_full"
      },
      "proposed_scope": {
        "description": "P00-11 settings command scope.",
        "enum": [
          "selected_job_and_future",
          "future_jobs_only"
        ]
      },
      "selected_job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "requires_user_action": {
        "const": true
      },
      "reversible": {
        "const": true
      },
      "creates_free_text_rule": {
        "const": false
      },
      "status": {
        "enum": [
          "proposed",
          "accepted",
          "dismissed"
        ]
      },
      "settings_command_id": {
        "description": "P00-11 settings command created on acceptance.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "full_access_consent_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "proposed_scope": {
              "const": "selected_job_and_future"
            }
          }
        },
        "then": {
          "required": [
            "selected_job_id"
          ]
        },
        "else": {
          "not": {
            "required": [
              "selected_job_id"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "accepted"
            }
          }
        },
        "then": {
          "required": [
            "settings_command_id",
            "full_access_consent_id"
          ]
        },
        "else": {
          "not": {
            "anyOf": [
              {
                "required": [
                  "settings_command_id"
                ]
              },
              {
                "required": [
                  "full_access_consent_id"
                ]
              }
            ]
          }
        }
      }
    ]
  },
  "question.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/question.schema.json",
    "title": "question_v1",
    "description": "The single B-level question (Y1): one question, one field key, at most 4 concrete options with the recommendation first. A proposal (Q77) carries exactly one concrete suggestion so that a natural-language 'tamam' binds to it. The answer decides this job only; making it permanent is a separate Memory/rule proposal. Delivered through a P00-03 pending invocation (input_request). Required fields are never asked with this object: they go to one required_input_form (TK-37).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "question_id",
      "job_id",
      "run_id",
      "conversation_id",
      "stage",
      "turn_id",
      "field_key",
      "kind",
      "prompt",
      "options",
      "recommended_option_id",
      "allows_free_text",
      "answer_scope",
      "counts_against_question_budget",
      "pending_invocation_id",
      "asked_at"
    ],
    "properties": {
      "schema_version": {
        "const": "question_v1"
      },
      "question_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "run_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "stage": {
        "$ref": "common.schema.json#/$defs/StageKey"
      },
      "turn_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "field_key": {
        "$ref": "common.schema.json#/$defs/FieldKey"
      },
      "kind": {
        "description": "choice: 2-4 options; proposal: exactly one concrete suggestion ('\u015f\u00f6yle yapal\u0131m, tamam dersen ba\u015flat\u0131r\u0131m').",
        "enum": [
          "choice",
          "proposal"
        ]
      },
      "prompt": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "options": {
        "type": "array",
        "minItems": 1,
        "maxItems": 4,
        "items": {
          "$ref": "#/$defs/Option"
        }
      },
      "recommended_option_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "allows_free_text": {
        "type": "boolean"
      },
      "answer_scope": {
        "const": "this_job_only"
      },
      "counts_against_question_budget": {
        "const": true
      },
      "pending_invocation_id": {
        "description": "P00-03 pending_invocation_v1 (kind input_request) that carries this question.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "asked_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "kind": {
              "const": "proposal"
            }
          }
        },
        "then": {
          "properties": {
            "options": {
              "maxItems": 1
            }
          }
        },
        "else": {
          "properties": {
            "options": {
              "minItems": 2
            }
          }
        }
      }
    ],
    "$defs": {
      "Option": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "option_id",
          "label",
          "value"
        ],
        "properties": {
          "option_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80
          },
          "value": {
            "$ref": "common.schema.json#/$defs/ScalarValue"
          },
          "thumbnail": {
            "$ref": "common.schema.json#/$defs/StorageThumbnailRef"
          }
        }
      }
    }
  },
  "required-input-form.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-policy/v1/required-input-form.schema.json",
    "title": "required_input_form_v1",
    "description": "All missing required fields of a job in one multi-field form (TK-37). It is outside the question budget and is never invented; the job waits in P00-03 job_status waiting_input (the pending invocation is P00-03 pending_invocation_v1 kind input_request). Delivery follows Q78: Chat form, REST POST /jobs/{id}/inputs, MCP elicitation when the client supports it, otherwise the provide_job_input tool.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "form_id",
      "job_id",
      "run_id",
      "pending_invocation_id",
      "job_status",
      "fields",
      "delivery",
      "counts_against_question_budget",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "required_input_form_v1"
      },
      "form_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "run_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "pending_invocation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_status": {
        "description": "The job waits in P00-03 waiting_input while the form is open.",
        "const": "waiting_input"
      },
      "fields": {
        "type": "array",
        "minItems": 1,
        "maxItems": 32,
        "items": {
          "$ref": "#/$defs/Field"
        }
      },
      "delivery": {
        "enum": [
          "chat_form",
          "rest_job_inputs",
          "mcp_elicitation",
          "mcp_provide_job_input_tool"
        ]
      },
      "counts_against_question_budget": {
        "const": false
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "$defs": {
      "Field": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "field_key",
          "label",
          "input_type"
        ],
        "properties": {
          "field_key": {
            "$ref": "common.schema.json#/$defs/FieldKey"
          },
          "label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          },
          "input_type": {
            "enum": [
              "text",
              "number",
              "choice",
              "media_ref",
              "date"
            ]
          },
          "options": {
            "type": "array",
            "minItems": 2,
            "maxItems": 16,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "option_id",
                "label",
                "value"
              ],
              "properties": {
                "option_id": {
                  "$ref": "common.schema.json#/$defs/OpaqueId"
                },
                "label": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 80
                },
                "value": {
                  "$ref": "common.schema.json#/$defs/ScalarValue"
                }
              }
            }
          },
          "help_text": {
            "type": "string",
            "maxLength": 300
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "input_type": {
                  "const": "choice"
                }
              }
            },
            "then": {
              "required": [
                "options"
              ]
            },
            "else": {
              "not": {
                "required": [
                  "options"
                ]
              }
            }
          }
        ]
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["assumption-record", "async-operation-ref", "continuation-batch", "external-action-grant", "full-access-consent", "join-point", "mode-setting-proposal", "question", "required-input-form"] as const;
export type DocumentType = "assumption-record" | "async-operation-ref" | "continuation-batch" | "external-action-grant" | "full-access-consent" | "join-point" | "mode-setting-proposal" | "question" | "required-input-form";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "assumption-record": [
    "assumption_record_v1"
  ],
  "async-operation-ref": [
    "async_operation_ref_v1"
  ],
  "continuation-batch": [
    "continuation_batch_v1"
  ],
  "external-action-grant": [
    "external_action_grant_v1"
  ],
  "full-access-consent": [
    "full_access_consent_v1"
  ],
  "join-point": [
    "join_point_v1"
  ],
  "mode-setting-proposal": [
    "mode_setting_proposal_v1"
  ],
  "question": [
    "question_v1"
  ],
  "required-input-form": [
    "required_input_form_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "assumption-record": {
    "status": [
      "active",
      "reverted",
      "superseded"
    ]
  },
  "mode-setting-proposal": {
    "status": [
      "accepted",
      "dismissed",
      "proposed"
    ]
  }
};

export type AssumptionRecord = {
    readonly "schema_version": "assumption_record_v1";
    readonly "assumption_id": string;
    readonly "job_id": string;
    readonly "run_id": string;
    readonly "stage": string;
    readonly "field_key": string;
    readonly "reason_kind": "two_reasonable_options" | "candidate_selection" | "question_budget_default" | "optional_item_omitted";
    readonly "confidence"?: number;
    readonly "chosen": unknown;
    readonly "alternatives": readonly (unknown)[];
    readonly "rationale": string;
    readonly "cost_effect": unknown;
    readonly "revert_target": unknown;
    readonly "decided_by": "agent";
    readonly "mode_at_decision": "ask" | "auto" | "auto_full";
    readonly "status": "active" | "reverted" | "superseded";
    readonly "reverted_at"?: string;
    readonly "created_at": string;
  };
export type AsyncOperationRef = {
    readonly "schema_version": "async_operation_ref_v1";
    readonly "operation_ref_id": string;
    readonly "job_id": string;
    readonly "run_id": string;
    readonly "tool_invocation_id": string;
    readonly "logical_operation_id": string;
    readonly "owner_bc": "workflow" | "composition" | "storage" | "connector" | "provider";
    readonly "owner_operation_id": string;
    readonly "lane": "D";
    readonly "join_point_id": string;
    readonly "wake_mode": "push_with_fallback_poll";
    readonly "cancel_on_new_message": false;
    readonly "accepted_at": string;
  };
export type ContinuationBatch = {
    readonly "schema_version": "continuation_batch_v1";
    readonly "continuation_id": string;
    readonly "job_id": string;
    readonly "run_id": string;
    readonly "join_point_id": string;
    readonly "items": readonly ({
    readonly "operation_ref_id": string;
    readonly "tool_result_id": string;
    readonly "completed_at": string;
  })[];
    readonly "created_at": string;
  };
export type ExternalActionGrant = {
    readonly "schema_version": "external_action_grant_v1";
    readonly "grant_id": string;
    readonly "tenant_id": string;
    readonly "user_id": string;
    readonly "connection": unknown;
    readonly "tool": unknown;
    readonly "effect_kinds": readonly ("send" | "publish" | "share" | "permanent_delete" | "external_spend" | "external_write")[];
    readonly "scope": "account_and_tool_revision";
    readonly "max_commitment": (unknown) | (null);
    readonly "source_decision": {
    readonly "review_request_id": string;
    readonly "decision_version": number;
  };
    readonly "granted_at": string;
    readonly "revoked_at": (string) | (null);
  };
export type FullAccessConsent = {
    readonly "schema_version": "full_access_consent_v1";
    readonly "consent_id": string;
    readonly "tenant_id": string;
    readonly "user_id": string;
    readonly "scope": "user_first_activation";
    readonly "warning_revision": string;
    readonly "shown_at": string;
    readonly "accepted_at": string;
  };
export type JoinPoint = {
    readonly "schema_version": "join_point_v1";
    readonly "join_point_id": string;
    readonly "job_id": string;
    readonly "run_id": string;
    readonly "awaited_operation_ref_ids": readonly (string)[];
    readonly "join_mode": "all" | "any";
    readonly "independent_step_ids": readonly (string)[];
    readonly "independent_steps_budget_scope": "same_job_current_authorization";
    readonly "state": "waiting" | "ready" | "resumed" | "canceled";
    readonly "continuation_id"?: string;
    readonly "created_at": string;
  };
export type ModeSettingProposal = {
    readonly "schema_version": "mode_setting_proposal_v1";
    readonly "proposal_id": string;
    readonly "conversation_id": string;
    readonly "trigger_message_id": string;
    readonly "detected_intent": "stop_asking_for_approval";
    readonly "proposed_mode": "auto_full";
    readonly "proposed_scope": "selected_job_and_future" | "future_jobs_only";
    readonly "selected_job_id"?: string;
    readonly "requires_user_action": true;
    readonly "reversible": true;
    readonly "creates_free_text_rule": false;
    readonly "status": "proposed" | "accepted" | "dismissed";
    readonly "settings_command_id"?: string;
    readonly "full_access_consent_id"?: string;
    readonly "created_at": string;
  };
export type Question = {
    readonly "schema_version": "question_v1";
    readonly "question_id": string;
    readonly "job_id": string;
    readonly "run_id": string;
    readonly "conversation_id": string;
    readonly "stage": string;
    readonly "turn_id": string;
    readonly "field_key": string;
    readonly "kind": "choice" | "proposal";
    readonly "prompt": string;
    readonly "options": readonly (unknown)[];
    readonly "recommended_option_id": string;
    readonly "allows_free_text": boolean;
    readonly "answer_scope": "this_job_only";
    readonly "counts_against_question_budget": true;
    readonly "pending_invocation_id": string;
    readonly "asked_at": string;
  };
export type RequiredInputForm = {
    readonly "schema_version": "required_input_form_v1";
    readonly "form_id": string;
    readonly "job_id": string;
    readonly "run_id": string;
    readonly "pending_invocation_id": string;
    readonly "job_status": "waiting_input";
    readonly "fields": readonly (unknown)[];
    readonly "delivery": "chat_form" | "rest_job_inputs" | "mcp_elicitation" | "mcp_provide_job_input_tool";
    readonly "counts_against_question_budget": false;
    readonly "created_at": string;
  };

export const reader = new ContractPackageReader({
  package: "assistant-policy",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
