// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/settings-lifecycle/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/settings-lifecycle/v1/common.schema.json",
    "title": "settings_lifecycle_common_v1",
    "description": "Shared definitions of the settings-lifecycle v1 package. Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "EnvelopeId": {
        "description": "Billing envelope id; format owned by P00-10.",
        "type": "string",
        "pattern": "^env_[A-Za-z0-9_-]{3,64}$"
      },
      "CompositionProjectId": {
        "description": "Composition project id (Spark project entry, PR #294): cprj_<uuid>.",
        "type": "string",
        "pattern": "^cprj_[0-9a-f-]{36}$"
      },
      "ModelId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9._:-]{1,128}$"
      },
      "CapabilityKey": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
        "maxLength": 128
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
      "Mode": {
        "description": "Canonical mode (Q24/Q74). This package's settings command is the only authority for the effective mode.",
        "enum": [
          "ask",
          "auto",
          "auto_full"
        ]
      },
      "ServerActor": {
        "description": "Authenticated actor resolved by the gateway (never taken from the request body). A tenant owner/admin role alone does not authorize settings of someone else's private conversation (PR01).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "user_id",
          "tenant_id"
        ],
        "properties": {
          "user_id": {
            "$ref": "#/$defs/OpaqueId"
          },
          "tenant_id": {
            "$ref": "#/$defs/OpaqueId"
          }
        }
      },
      "MediaModelMap": {
        "description": "Default media model per capability (planner, media and embedding models are separate, KARAR-COKLU \u00a72).",
        "type": "object",
        "maxProperties": 16,
        "propertyNames": {
          "$ref": "#/$defs/CapabilityKey"
        },
        "additionalProperties": {
          "oneOf": [
            {
              "$ref": "#/$defs/ModelId"
            },
            {
              "type": "null"
            }
          ]
        }
      }
    }
  },
  "conversation-defaults.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/settings-lifecycle/v1/conversation-defaults.schema.json",
    "title": "conversation_defaults_v1",
    "description": "New-job defaults of a conversation (D03/D04). Only jobs created after a change read them; existing jobs keep their own job_settings_v1. Copying a default into a new job never copies another job's grant or allocation.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "conversation_id",
      "tenant_id",
      "owner_user_id",
      "defaults_version",
      "default_mode",
      "default_planner_model_id",
      "default_media_model_ids",
      "updated_at"
    ],
    "properties": {
      "schema_version": {
        "const": "conversation_defaults_v1"
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "owner_user_id": {
        "description": "Conversation owner: the only authority for the new-job defaults (coordinator decision 26 Sep 2026).",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "defaults_version": {
        "description": "CAS counter; the settings command carries it as expected_conversation_defaults_version.",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "default_mode": {
        "$ref": "common.schema.json#/$defs/Mode"
      },
      "default_planner_model_id": {
        "$ref": "common.schema.json#/$defs/ModelId"
      },
      "default_media_model_ids": {
        "$ref": "common.schema.json#/$defs/MediaModelMap"
      },
      "last_command_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "updated_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "job-settings.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/settings-lifecycle/v1/job-settings.schema.json",
    "title": "job_settings_v1",
    "description": "Effective settings and grant snapshot of one job (D03/D04). requested_* is what the last committed command asked for; effective_* is what the job uses now. A planner model change becomes effective at the next safe inference boundary (model_epoch + 1); a mode change at the next dispatch boundary, except that an upgrade re-evaluates the selected job's pending gate at once. Earlier attempts stay immutable (P00-03 inference_execution_spec_v1 pins job_settings_version and model_epoch).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "job_id",
      "conversation_id",
      "initiated_by_user_id",
      "job_settings_version",
      "requested_mode",
      "effective_mode",
      "requested_planner_model_id",
      "effective_planner_model_id",
      "pending_model_switch",
      "model_epoch",
      "media_model_ids",
      "created_from_defaults_version",
      "grant_snapshot",
      "updated_at"
    ],
    "properties": {
      "schema_version": {
        "const": "job_settings_v1"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "initiated_by_user_id": {
        "description": "The user who started the job: the only authority for this job's settings (coordinator decision 26 Sep 2026). In a shared conversation the conversation owner cannot change another member's job.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_settings_version": {
        "description": "CAS counter; the settings command carries it as expected_job_settings_version. Starts at 1.",
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "requested_mode": {
        "$ref": "common.schema.json#/$defs/Mode"
      },
      "effective_mode": {
        "$ref": "common.schema.json#/$defs/Mode"
      },
      "requested_planner_model_id": {
        "$ref": "common.schema.json#/$defs/ModelId"
      },
      "effective_planner_model_id": {
        "$ref": "common.schema.json#/$defs/ModelId"
      },
      "pending_model_switch": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/PendingModelSwitch"
          }
        ]
      },
      "model_epoch": {
        "$ref": "common.schema.json#/$defs/Version"
      },
      "media_model_ids": {
        "$ref": "common.schema.json#/$defs/MediaModelMap"
      },
      "created_from_defaults_version": {
        "$ref": "common.schema.json#/$defs/Version"
      },
      "grant_snapshot": {
        "$ref": "#/$defs/GrantSnapshot"
      },
      "last_command_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "updated_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "$defs": {
      "PendingModelSwitch": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "target_model_id",
          "command_id",
          "effective_at"
        ],
        "properties": {
          "target_model_id": {
            "$ref": "common.schema.json#/$defs/ModelId"
          },
          "command_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "effective_at": {
            "const": "next_safe_inference_boundary"
          }
        }
      },
      "GrantSnapshot": {
        "description": "This job's own execution grant (the authorization itself lives in the P00-10 envelope). Never inherited from another job.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "grant_version",
          "basis",
          "envelope_id",
          "inherited_from_job_id"
        ],
        "properties": {
          "grant_version": {
            "description": "Mirror of the P00-10 approval_version of this job's envelope (grant_version := approval_version; 0 = no grant yet: basis none, or an envelope without a grant). P00-03 job_version_vector_v1.grant_version carries the same value (money/mode audit, 26 Sep 2026).",
            "$ref": "common.schema.json#/$defs/Version"
          },
          "basis": {
            "description": "none before any grant; otherwise the P00-10 authorization basis.",
            "enum": [
              "none",
              "preparation_grant",
              "mode_snapshot",
              "user_approval",
              "scheduled_bypass",
              "principal_bypass"
            ]
          },
          "envelope_id": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/EnvelopeId"
              },
              {
                "type": "null"
              }
            ]
          },
          "inherited_from_job_id": {
            "type": "null"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "none"
                }
              }
            },
            "then": {
              "properties": {
                "grant_version": {
                  "const": 0
                }
              }
            },
            "else": {
              "properties": {
                "grant_version": {
                  "minimum": 1
                },
                "envelope_id": {
                  "$ref": "common.schema.json#/$defs/EnvelopeId"
                }
              }
            }
          }
        ]
      }
    }
  },
  "plan-revision-event.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/settings-lifecycle/v1/plan-revision-event.schema.json",
    "title": "feature_control_plan_changed_v1",
    "description": "Outbox event emitted when a tenant's Feature Control subscription_plan_revision changes. New admission and cache fills use the new revision; accepted remote work is never resubmitted; existing projects stay open and editable and new limits apply only to new jobs (Q87). Consumers classify the revision as apply/duplicate/stale/gap like the existing Billing plan-change handler.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "event_id",
      "tenant_id",
      "subscription_plan_revision_before",
      "subscription_plan_revision_after",
      "direction",
      "occurred_at",
      "outbox_event_id"
    ],
    "properties": {
      "schema_version": {
        "const": "feature_control_plan_changed_v1"
      },
      "event_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "subscription_plan_revision_before": {
        "$ref": "common.schema.json#/$defs/Version"
      },
      "subscription_plan_revision_after": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "direction": {
        "enum": [
          "upgrade",
          "downgrade",
          "lateral"
        ]
      },
      "plan_type_before": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,31}$"
      },
      "plan_type_after": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,31}$"
      },
      "occurred_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "outbox_event_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      }
    }
  },
  "revocation-event.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/settings-lifecycle/v1/revocation-event.schema.json",
    "title": "revocation_event_v1",
    "description": "The single revocation/authority-reduction event of the platform (coordinator decision 26 Sep 2026: P00-11 owns the revocation event and its lifecycle matrix; P00-07 owns what each grant type means per resource and is referenced in prose). Every later dispatch must see it (R04, MIMARI \u00a73, Connector \u00a75, D04, Q87). Its effect on new selection, new read/inference/write dispatch, cache/context reuse and accepted work is fixed in revocation-rules.json. generation fences caches. Accepted or outcome-unknown work keeps only the recovery authority (status, receipt, settlement, cancel, drain) for exact operation ids and never a new effect; the user can always cancel their own job (Q76/Q91). content_delete / content_update (final Wave 0 audit, K35): an owner deleted or replaced a resource revision (Memory item, message, conversation, upload); like every source-reducing kind it bumps the P00-03 context_epoch so no old checkpoint, summary or provider appendix is reused.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "revocation_id",
      "tenant_id",
      "revocation_kind",
      "subject",
      "actor",
      "generation",
      "effective_at",
      "sunset_at",
      "recovery_authority",
      "outbox_event_id"
    ],
    "properties": {
      "schema_version": {
        "const": "revocation_event_v1"
      },
      "revocation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "revocation_kind": {
        "enum": [
          "security_revoke",
          "disable",
          "uninstall",
          "deprecate",
          "source_acl_revoke",
          "content_grant_revoke",
          "connection_grant_revoke",
          "project_grant_revoke",
          "mode_grant_downgrade",
          "plan_downgrade",
          "content_delete",
          "content_update"
        ]
      },
      "subject": {
        "$ref": "#/$defs/Subject"
      },
      "actor": {
        "description": "Who issued the revocation. A security revoke comes only from a security operator or the system.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "user",
              "security_operator",
              "system"
            ]
          },
          "id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "generation": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "effective_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "sunset_at": {
        "description": "deprecate only: the pinned revision stays selectable until this time; afterwards the next dispatch is blocked. null for every other kind.",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          {
            "type": "null"
          }
        ]
      },
      "recovery_authority": {
        "$ref": "#/$defs/RecoveryAuthority"
      },
      "outbox_event_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "enum": [
                "security_revoke",
                "disable",
                "uninstall",
                "deprecate"
              ]
            }
          }
        },
        "then": {
          "properties": {
            "subject": {
              "properties": {
                "subject_kind": {
                  "const": "skill_revision"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "const": "source_acl_revoke"
            }
          }
        },
        "then": {
          "properties": {
            "subject": {
              "properties": {
                "subject_kind": {
                  "enum": [
                    "owner_resource",
                    "skill_revision"
                  ]
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "const": "connection_grant_revoke"
            }
          }
        },
        "then": {
          "properties": {
            "subject": {
              "properties": {
                "subject_kind": {
                  "const": "connection"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "const": "mode_grant_downgrade"
            }
          }
        },
        "then": {
          "properties": {
            "subject": {
              "properties": {
                "subject_kind": {
                  "const": "job_mode_grant"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "const": "plan_downgrade"
            }
          }
        },
        "then": {
          "properties": {
            "subject": {
              "properties": {
                "subject_kind": {
                  "const": "tenant_plan"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "const": "content_grant_revoke"
            }
          }
        },
        "then": {
          "properties": {
            "subject": {
              "properties": {
                "subject_kind": {
                  "const": "content_grant"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "const": "project_grant_revoke"
            }
          }
        },
        "then": {
          "properties": {
            "subject": {
              "properties": {
                "subject_kind": {
                  "const": "project_asset_grant"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "enum": [
                "content_delete",
                "content_update"
              ]
            }
          }
        },
        "then": {
          "properties": {
            "subject": {
              "properties": {
                "subject_kind": {
                  "const": "content_resource"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "const": "deprecate"
            }
          }
        },
        "then": {
          "properties": {
            "sunset_at": {
              "$ref": "common.schema.json#/$defs/Timestamp"
            }
          }
        },
        "else": {
          "properties": {
            "sunset_at": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "revocation_kind": {
              "const": "security_revoke"
            }
          }
        },
        "then": {
          "properties": {
            "actor": {
              "properties": {
                "kind": {
                  "enum": [
                    "security_operator",
                    "system"
                  ]
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "Subject": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "subject_kind",
              "skill_id",
              "skill_revision_id"
            ],
            "properties": {
              "subject_kind": {
                "const": "skill_revision"
              },
              "skill_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "skill_revision_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "scope_user_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "subject_kind",
              "owner_bc",
              "resource_id",
              "actor_user_id"
            ],
            "properties": {
              "subject_kind": {
                "const": "owner_resource"
              },
              "owner_bc": {
                "enum": [
                  "storage",
                  "brand",
                  "composition",
                  "memory",
                  "avatar",
                  "voice",
                  "assistant"
                ]
              },
              "resource_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "actor_user_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "subject_kind",
              "grant_id",
              "owner_bc",
              "resource_id"
            ],
            "properties": {
              "subject_kind": {
                "const": "content_grant"
              },
              "grant_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "owner_bc": {
                "enum": [
                  "storage",
                  "brand",
                  "composition",
                  "memory",
                  "avatar",
                  "voice",
                  "assistant"
                ]
              },
              "resource_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "subject_kind",
              "connection_id"
            ],
            "properties": {
              "subject_kind": {
                "const": "connection"
              },
              "connection_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "grantee_user_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "subject_kind",
              "grant_id",
              "project_id",
              "storage_object_id"
            ],
            "properties": {
              "subject_kind": {
                "const": "project_asset_grant"
              },
              "grant_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "project_id": {
                "$ref": "common.schema.json#/$defs/CompositionProjectId"
              },
              "storage_object_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "subject_kind",
              "job_id",
              "job_settings_version"
            ],
            "properties": {
              "subject_kind": {
                "const": "job_mode_grant"
              },
              "job_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "job_settings_version": {
                "$ref": "common.schema.json#/$defs/Revision"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "subject_kind",
              "subscription_plan_revision"
            ],
            "properties": {
              "subject_kind": {
                "const": "tenant_plan"
              },
              "subscription_plan_revision": {
                "$ref": "common.schema.json#/$defs/Revision"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "subject_kind",
              "owner_bc",
              "resource_type",
              "resource_id",
              "owner_user_id"
            ],
            "properties": {
              "subject_kind": {
                "const": "content_resource"
              },
              "owner_bc": {
                "enum": [
                  "storage",
                  "brand",
                  "composition",
                  "memory",
                  "avatar",
                  "voice",
                  "assistant"
                ]
              },
              "resource_type": {
                "description": "P00-07 scope-grants v1 ResourceType (prose reference until Wave 0 acceptance).",
                "enum": [
                  "conversation",
                  "memory_item",
                  "personal_instruction",
                  "skill_definition",
                  "composition_project",
                  "storage_object",
                  "brand_kit",
                  "brand_element",
                  "brand_template",
                  "motion",
                  "avatar",
                  "voice_profile"
                ]
              },
              "resource_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "owner_user_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              }
            }
          }
        ]
      },
      "RecoveryAuthority": {
        "description": "Narrow authority kept by accepted or outcome-unknown work after a revocation: exactly status, receipt, settlement, cancel and drain for the listed operation ids; never a new submit or effect.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "allowed_actions",
          "accepted_operation_ids",
          "grants_new_effect"
        ],
        "properties": {
          "allowed_actions": {
            "type": "array",
            "minItems": 5,
            "maxItems": 5,
            "uniqueItems": true,
            "items": {
              "enum": [
                "status",
                "receipt",
                "settlement",
                "cancel",
                "drain"
              ]
            }
          },
          "accepted_operation_ids": {
            "type": "array",
            "maxItems": 1000,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/OpaqueId"
            }
          },
          "grants_new_effect": {
            "const": false
          }
        }
      }
    }
  },
  "settings-command-result.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/settings-lifecycle/v1/settings-command-result.schema.json",
    "title": "settings_command_result_v1",
    "description": "Explicit result of a settings command. Nothing is ever partially applied: a rejection or conflict changes neither the job nor the defaults, and other jobs and their pending approvals are never touched.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "command_id",
      "outcome",
      "conversation_defaults_version",
      "partial_application",
      "other_jobs",
      "decided_at"
    ],
    "properties": {
      "schema_version": {
        "const": "settings_command_result_v1"
      },
      "command_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "outcome": {
        "enum": [
          "applied",
          "replayed",
          "rejected_idempotency_conflict",
          "rejected_forbidden",
          "rejected_defaults_owner_only",
          "rejected_missing_target",
          "rejected_target_not_found",
          "rejected_target_terminal",
          "rejected_full_access_consent_required",
          "rejected_unsupported_model",
          "conflict"
        ]
      },
      "conversation_defaults_version": {
        "description": "Version after the command when applied/replayed; the current version otherwise (selected_job_only never changes it).",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "job_settings_version": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "stale_versions": {
        "type": "array",
        "minItems": 1,
        "maxItems": 2,
        "uniqueItems": true,
        "items": {
          "enum": [
            "job_settings",
            "conversation_defaults"
          ]
        }
      },
      "effects": {
        "type": "array",
        "maxItems": 4,
        "items": {
          "$ref": "#/$defs/Effect"
        }
      },
      "partial_application": {
        "const": false
      },
      "other_jobs": {
        "const": "unchanged"
      },
      "decided_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "outcome": {
              "const": "conflict"
            }
          }
        },
        "then": {
          "required": [
            "stale_versions"
          ]
        },
        "else": {
          "not": {
            "required": [
              "stale_versions"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "outcome": {
              "enum": [
                "applied",
                "replayed"
              ]
            }
          }
        },
        "then": {
          "required": [
            "effects"
          ]
        },
        "else": {
          "not": {
            "required": [
              "effects"
            ]
          }
        }
      }
    ],
    "$defs": {
      "Effect": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind"
        ],
        "properties": {
          "kind": {
            "description": "defaults_updated: new jobs read the new defaults; mode_at_next_dispatch: selected job's mode applies at its next dispatch boundary; reevaluate_pending_gate: an upgrade re-evaluates only the selected job's pending gate under current policy (no human approval is recorded, rejected/canceled work is not revived); pending_model_switch: selected job switches planner model at the next safe inference boundary.",
            "enum": [
              "defaults_updated",
              "mode_at_next_dispatch",
              "reevaluate_pending_gate",
              "pending_model_switch"
            ]
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "defaults_updated"
                }
              }
            },
            "then": {
              "not": {
                "required": [
                  "job_id"
                ]
              }
            },
            "else": {
              "required": [
                "job_id"
              ]
            }
          }
        ]
      }
    }
  },
  "settings-command.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/settings-lifecycle/v1/settings-command.schema.json",
    "title": "settings_command_v1",
    "description": "The only way to change the effective mode or planner model (coordinator decision; D03/D04). selected_job_and_future updates the exact selected job and the conversation new-job defaults in one atomic dual-version CAS; selected_job_only updates only the exact selected job; future_jobs_only updates only the defaults. Authority (coordinator decision 26 Sep 2026, final Wave 0 audit): job settings belong to the user who started the job, the defaults to the conversation owner; in a shared conversation a member changes only the jobs they started (selected_job_only) and never the defaults. An admin role or a content grant is never settings authority. A missing, stale, foreign or terminal target is rejected, never converted into a defaults-only or global change. composer_selection.mode in a message is only a hint (P00-03). The P00-13 'bana onay sorma' proposal and the auto_full first-activation consent are applied through this command.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "command_id",
      "idempotency_key",
      "conversation_id",
      "actor",
      "scope",
      "changes",
      "source",
      "issued_at"
    ],
    "properties": {
      "schema_version": {
        "const": "settings_command_v1"
      },
      "command_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "idempotency_key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "actor": {
        "$ref": "common.schema.json#/$defs/ServerActor"
      },
      "scope": {
        "enum": [
          "selected_job_and_future",
          "selected_job_only",
          "future_jobs_only"
        ]
      },
      "selected_job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "expected_job_settings_version": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "expected_conversation_defaults_version": {
        "description": "Required unless scope is selected_job_only (which never touches the defaults and must not carry it).",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "changes": {
        "type": "object",
        "additionalProperties": false,
        "minProperties": 1,
        "properties": {
          "mode": {
            "$ref": "common.schema.json#/$defs/Mode"
          },
          "planner_model_id": {
            "$ref": "common.schema.json#/$defs/ModelId"
          }
        }
      },
      "source": {
        "description": "composer_control: the mode/model control in the composer; mode_setting_proposal: the P00-13 'bana onay sorma' proposal accepted by the user.",
        "enum": [
          "composer_control",
          "mode_setting_proposal"
        ]
      },
      "mode_setting_proposal_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "full_access_consent_id": {
        "description": "P00-13 full_access_consent_v1 of the actor; required whenever the command sets auto_full.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "issued_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "scope": {
              "const": "selected_job_only"
            }
          }
        },
        "then": {
          "not": {
            "required": [
              "expected_conversation_defaults_version"
            ]
          }
        },
        "else": {
          "required": [
            "expected_conversation_defaults_version"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "scope": {
              "enum": [
                "selected_job_and_future",
                "selected_job_only"
              ]
            }
          }
        },
        "then": {
          "required": [
            "selected_job_id",
            "expected_job_settings_version"
          ]
        },
        "else": {
          "not": {
            "anyOf": [
              {
                "required": [
                  "selected_job_id"
                ]
              },
              {
                "required": [
                  "expected_job_settings_version"
                ]
              }
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "source": {
              "const": "mode_setting_proposal"
            }
          }
        },
        "then": {
          "required": [
            "mode_setting_proposal_id"
          ],
          "properties": {
            "changes": {
              "required": [
                "mode"
              ],
              "properties": {
                "mode": {
                  "const": "auto_full"
                }
              }
            }
          }
        },
        "else": {
          "not": {
            "required": [
              "mode_setting_proposal_id"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "changes": {
              "required": [
                "mode"
              ],
              "properties": {
                "mode": {
                  "const": "auto_full"
                }
              }
            }
          }
        },
        "then": {
          "required": [
            "full_access_consent_id"
          ]
        }
      }
    ]
  }
} as const;

export const DOCUMENT_TYPES = ["conversation-defaults", "job-settings", "plan-revision-event", "revocation-event", "settings-command", "settings-command-result"] as const;
export type DocumentType = "conversation-defaults" | "job-settings" | "plan-revision-event" | "revocation-event" | "settings-command" | "settings-command-result";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "conversation-defaults": [
    "conversation_defaults_v1"
  ],
  "job-settings": [
    "job_settings_v1"
  ],
  "plan-revision-event": [
    "feature_control_plan_changed_v1"
  ],
  "revocation-event": [
    "revocation_event_v1"
  ],
  "settings-command": [
    "settings_command_v1"
  ],
  "settings-command-result": [
    "settings_command_result_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type ConversationDefaults = {
    readonly "schema_version": "conversation_defaults_v1";
    readonly "conversation_id": string;
    readonly "tenant_id": string;
    readonly "owner_user_id": string;
    readonly "defaults_version": number;
    readonly "default_mode": "ask" | "auto" | "auto_full";
    readonly "default_planner_model_id": string;
    readonly "default_media_model_ids": unknown;
    readonly "last_command_id"?: string;
    readonly "updated_at": string;
  };
export type JobSettings = {
    readonly "schema_version": "job_settings_v1";
    readonly "job_id": string;
    readonly "conversation_id": string;
    readonly "initiated_by_user_id": string;
    readonly "job_settings_version": number;
    readonly "requested_mode": "ask" | "auto" | "auto_full";
    readonly "effective_mode": "ask" | "auto" | "auto_full";
    readonly "requested_planner_model_id": string;
    readonly "effective_planner_model_id": string;
    readonly "pending_model_switch": (null) | (unknown);
    readonly "model_epoch": number;
    readonly "media_model_ids": unknown;
    readonly "created_from_defaults_version": number;
    readonly "grant_snapshot": unknown;
    readonly "last_command_id"?: string;
    readonly "updated_at": string;
  };
export type PlanRevisionEvent = {
    readonly "schema_version": "feature_control_plan_changed_v1";
    readonly "event_id": string;
    readonly "tenant_id": string;
    readonly "subscription_plan_revision_before": number;
    readonly "subscription_plan_revision_after": number;
    readonly "direction": "upgrade" | "downgrade" | "lateral";
    readonly "plan_type_before"?: string;
    readonly "plan_type_after"?: string;
    readonly "occurred_at": string;
    readonly "outbox_event_id": string;
  };
export type RevocationEvent = {
    readonly "schema_version": "revocation_event_v1";
    readonly "revocation_id": string;
    readonly "tenant_id": string;
    readonly "revocation_kind": "security_revoke" | "disable" | "uninstall" | "deprecate" | "source_acl_revoke" | "content_grant_revoke" | "connection_grant_revoke" | "project_grant_revoke" | "mode_grant_downgrade" | "plan_downgrade" | "content_delete" | "content_update";
    readonly "subject": unknown;
    readonly "actor": {
    readonly "kind": "user" | "security_operator" | "system";
    readonly "id": string;
  };
    readonly "generation": number;
    readonly "effective_at": string;
    readonly "sunset_at": (string) | (null);
    readonly "recovery_authority": unknown;
    readonly "outbox_event_id": string;
  };
export type SettingsCommand = {
    readonly "schema_version": "settings_command_v1";
    readonly "command_id": string;
    readonly "idempotency_key": string;
    readonly "conversation_id": string;
    readonly "actor": unknown;
    readonly "scope": "selected_job_and_future" | "selected_job_only" | "future_jobs_only";
    readonly "selected_job_id"?: string;
    readonly "expected_job_settings_version"?: number;
    readonly "expected_conversation_defaults_version"?: number;
    readonly "changes": {
    readonly "mode"?: "ask" | "auto" | "auto_full";
    readonly "planner_model_id"?: string;
  };
    readonly "source": "composer_control" | "mode_setting_proposal";
    readonly "mode_setting_proposal_id"?: string;
    readonly "full_access_consent_id"?: string;
    readonly "issued_at": string;
  };
export type SettingsCommandResult = {
    readonly "schema_version": "settings_command_result_v1";
    readonly "command_id": string;
    readonly "outcome": "applied" | "replayed" | "rejected_idempotency_conflict" | "rejected_forbidden" | "rejected_defaults_owner_only" | "rejected_missing_target" | "rejected_target_not_found" | "rejected_target_terminal" | "rejected_full_access_consent_required" | "rejected_unsupported_model" | "conflict";
    readonly "conversation_defaults_version": number;
    readonly "job_settings_version"?: number;
    readonly "stale_versions"?: readonly ("job_settings" | "conversation_defaults")[];
    readonly "effects"?: readonly (unknown)[];
    readonly "partial_application": false;
    readonly "other_jobs": "unchanged";
    readonly "decided_at": string;
  };

export const reader = new ContractPackageReader({
  package: "settings-lifecycle",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
