// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/assistant-runtime/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "assistant-message-context.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/assistant-message-context.schema.json",
    "title": "assistant_message_context_v1",
    "description": "Canonical content_json of a user message, shared by Dashboard Chat, Spark Chat and workflow authoring. The whole object lives inside the message content_json, so the existing request fingerprint (raw content + content_json) keeps covering attachments, targets and replies. Actor, tenant, invocation cause, grant and mode authority are server-derived and cannot appear here. Legacy (unversioned) content_json is read through content-json-compat.json.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "surface"
    ],
    "properties": {
      "schema_version": {
        "const": "assistant_message_context_v1"
      },
      "surface": {
        "$ref": "common.schema.json#/$defs/Surface"
      },
      "surface_context": {
        "oneOf": [
          {
            "$ref": "#/$defs/SparkSurfaceContext"
          },
          {
            "$ref": "#/$defs/MotionSurfaceContext"
          }
        ]
      },
      "channel_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "locale": {
        "type": "string",
        "pattern": "^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$"
      },
      "attachments": {
        "type": "array",
        "maxItems": 32,
        "uniqueItems": true,
        "items": {
          "$ref": "owner-refs.schema.json#/$defs/StorageObjectRef"
        }
      },
      "mentions": {
        "type": "array",
        "maxItems": 32,
        "items": {
          "$ref": "#/$defs/Mention"
        }
      },
      "selected_skill_refs": {
        "description": "Skills chosen from the slash menu 'Skill'lerim' group (TK-40). Selection does not grant tool, cost or OAuth authority.",
        "type": "array",
        "maxItems": 8,
        "uniqueItems": true,
        "items": {
          "$ref": "owner-refs.schema.json#/$defs/SkillRevisionRef"
        }
      },
      "preferred_tools": {
        "description": "Slash-menu tool or connection chips. Selection executes nothing; policy, mode and budget are checked server-side.",
        "type": "array",
        "maxItems": 8,
        "uniqueItems": true,
        "items": {
          "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
        }
      },
      "composer_selection": {
        "$ref": "#/$defs/ComposerSelection"
      },
      "job_target": {
        "$ref": "#/$defs/JobTarget"
      },
      "reply_to": {
        "$ref": "#/$defs/ReplyTo"
      },
      "pinned_constraints": {
        "type": "array",
        "maxItems": 20,
        "items": {
          "type": "string",
          "minLength": 1,
          "maxLength": 1000
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "surface": {
              "const": "spark_chat"
            }
          }
        },
        "then": {
          "required": [
            "surface_context"
          ],
          "properties": {
            "surface_context": {
              "$ref": "#/$defs/SparkSurfaceContext"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "surface": {
              "const": "motion_authoring"
            }
          }
        },
        "then": {
          "required": [
            "surface_context"
          ],
          "properties": {
            "surface_context": {
              "$ref": "#/$defs/MotionSurfaceContext"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "surface": {
              "enum": [
                "dashboard_chat",
                "workflow_authoring"
              ]
            }
          }
        },
        "then": {
          "not": {
            "required": [
              "surface_context"
            ]
          }
        }
      },
      {
        "if": {
          "required": [
            "reply_to"
          ]
        },
        "then": {
          "required": [
            "job_target"
          ],
          "properties": {
            "job_target": {
              "properties": {
                "relation": {
                  "const": "reply"
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "SparkSurfaceContext": {
        "description": "Spark editor context sent with each message. It is a hint for binding, never a grant. EditContext (playhead/selection) is owned by P00-13 and is attached here by cross-package $ref (P03-07): the selection resolves to explicit handles at parse time against its base_revision; the Gateway additionally requires edit_context.project_id == project_id and edit_context.base_revision == seen_working_copy_version.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "project_id",
          "seen_working_copy_version"
        ],
        "properties": {
          "project_id": {
            "$ref": "common.schema.json#/$defs/CompositionProjectId"
          },
          "seen_working_copy_version": {
            "$ref": "common.schema.json#/$defs/Version"
          },
          "edit_context": {
            "$ref": "../../motion-spark/v1/edit-context.schema.json"
          }
        }
      },
      "MotionSurfaceContext": {
        "description": "Motion authoring screen context (E1-H, additive v1): the private Motion draft the chat edits and the draft version the user saw. A hint for binding, never a grant: Brand re-checks that the actor owns the draft at every tool call, and an edit names the version it read (CAS), so a draft that moved in between is a conflict, never an overwrite.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "draft_id",
          "seen_draft_version"
        ],
        "properties": {
          "draft_id": {
            "type": "string",
            "pattern": "^bmotd_[A-Za-z0-9_-]{1,64}$"
          },
          "seen_draft_version": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "Mention": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref",
          "display_label"
        ],
        "properties": {
          "ref": {
            "$ref": "owner-refs.schema.json"
          },
          "display_label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          }
        }
      },
      "ComposerSelection": {
        "description": "Composer state at send time. mode here is a client-declared request hint for the message; the effective mode and grant come from the job settings snapshot (P00-11) and are never derived from message content.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "chat_profile",
          "model_id",
          "mode"
        ],
        "properties": {
          "chat_profile": {
            "enum": [
              "fast",
              "pro",
              "max"
            ]
          },
          "model_id": {
            "$ref": "common.schema.json#/$defs/ModelId"
          },
          "mode": {
            "$ref": "common.schema.json#/$defs/Mode"
          },
          "video_duration_seconds": {
            "type": "integer",
            "minimum": 5,
            "maximum": 14400
          },
          "aspect_ratio": {
            "enum": [
              "16:9",
              "9:16",
              "1:1"
            ]
          },
          "selected_models": {
            "type": "object",
            "maxProperties": 16,
            "propertyNames": {
              "$ref": "common.schema.json#/$defs/CapabilityKey"
            },
            "additionalProperties": {
              "oneOf": [
                {
                  "$ref": "common.schema.json#/$defs/ModelId"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "selected_model_inputs": {
            "description": "Per-capability model inputs; validated against the Provider catalog input_schema at dispatch.",
            "type": "object",
            "maxProperties": 16,
            "propertyNames": {
              "$ref": "common.schema.json#/$defs/CapabilityKey"
            },
            "additionalProperties": {
              "type": "object",
              "maxProperties": 32,
              "propertyNames": {
                "pattern": "^[a-z][a-z0-9_]{0,63}$"
              },
              "additionalProperties": {
                "oneOf": [
                  {
                    "type": [
                      "string",
                      "number",
                      "boolean",
                      "null"
                    ]
                  },
                  {
                    "type": "array",
                    "maxItems": 16,
                    "items": {
                      "type": [
                        "string",
                        "number",
                        "boolean"
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      "JobTarget": {
        "description": "Explicit job target (K05/K65). Absent target lets the server resolve new job vs. the single open pending invocation (F17a). Cancel is a separate command, not a message.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "relation"
            ],
            "properties": {
              "relation": {
                "const": "new_job"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "relation",
              "job_id",
              "expected_job_version"
            ],
            "properties": {
              "relation": {
                "enum": [
                  "reply",
                  "steer",
                  "supersede"
                ]
              },
              "job_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "expected_job_version": {
                "$ref": "common.schema.json#/$defs/Version"
              }
            }
          }
        ]
      },
      "ReplyTo": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "pending_invocation_id",
          "expected_pending_version"
        ],
        "properties": {
          "pending_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "expected_pending_version": {
            "$ref": "common.schema.json#/$defs/Revision"
          }
        }
      }
    }
  },
  "canonical-context.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/canonical-context.schema.json",
    "title": "canonical_context_v1",
    "description": "Provider-neutral semantic context of one job inference boundary (KARAR-COKLU-MODEL \u00a73). It is rebuilt from the latest authoritative checkpoint plus later durable events up to through_event_sequence, never from a trigger-message time cutoff (K50). It carries no provider-native state; that lives in provider-protocol-appendix records that point back here. K35 (final Wave 0 audit, coordinator decision 26 Sep 2026): a checkpoint, summary or appendix is reused only under the same context_epoch; a revoke/delete/update of a source bumps the epoch and the next inference rebuilds from durable events with that source filtered (context-reuse-rules.json). Each entry records its source's P00-07 scope_generation and visibility; in a shared record a private-source entry needs an explicit share decision (rule owner: P00-07 shared_record_context_filter).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "canonical_context_id",
      "conversation_id",
      "job_id",
      "context_epoch",
      "record_visibility",
      "through_event_sequence",
      "entries",
      "system_guide_refs",
      "selected_skill_refs",
      "open_pending_invocation_ids",
      "context_hash"
    ],
    "properties": {
      "schema_version": {
        "const": "canonical_context_v1"
      },
      "canonical_context_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "context_epoch": {
        "description": "Increments whenever a source can leave the readable set or change: Memory/content delete or update, source ACL/content/connection/project grant revoke, skill security revoke/disable/uninstall, visibility change, channel profile generation (context-reuse-rules.json bump_triggers). A checkpoint, summary or provider appendix of an older epoch is never reused.",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "record_visibility": {
        "description": "Visibility of the record the job belongs to (conversation or Composition project; P00-07). shared: a private-source entry needs share_decision_ref.",
        "$ref": "common.schema.json#/$defs/Visibility"
      },
      "checkpoint": {
        "$ref": "#/$defs/Checkpoint"
      },
      "through_event_sequence": {
        "$ref": "common.schema.json#/$defs/EventSequence"
      },
      "entries": {
        "type": "array",
        "maxItems": 512,
        "items": {
          "$ref": "#/$defs/Entry"
        }
      },
      "system_guide_refs": {
        "type": "array",
        "maxItems": 16,
        "uniqueItems": true,
        "items": {
          "$ref": "owner-refs.schema.json#/$defs/SkillRevisionRef"
        }
      },
      "selected_skill_refs": {
        "description": "Bounded active skill subset for this job/stage (P01A).",
        "type": "array",
        "maxItems": 8,
        "uniqueItems": true,
        "items": {
          "$ref": "owner-refs.schema.json#/$defs/SkillRevisionRef"
        }
      },
      "open_pending_invocation_ids": {
        "type": "array",
        "maxItems": 32,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/OpaqueId"
        }
      },
      "context_hash": {
        "$ref": "common.schema.json#/$defs/Sha256"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "record_visibility": {
              "const": "shared"
            }
          },
          "required": [
            "record_visibility"
          ]
        },
        "then": {
          "properties": {
            "entries": {
              "items": {
                "if": {
                  "properties": {
                    "source_visibility": {
                      "const": "private"
                    }
                  },
                  "required": [
                    "source_visibility"
                  ]
                },
                "then": {
                  "required": [
                    "share_decision_ref"
                  ]
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "Checkpoint": {
        "type": "object",
        "additionalProperties": false,
        "description": "Durable summary checkpoint. Reusable only while its context_epoch equals the canonical context's context_epoch (record-invariants.json inv_checkpoint_epoch_matches_context); otherwise the context is rebuilt from durable events.",
        "required": [
          "checkpoint_id",
          "context_epoch",
          "through_event_sequence",
          "checkpoint_sha256"
        ],
        "properties": {
          "checkpoint_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "context_epoch": {
            "$ref": "common.schema.json#/$defs/Version"
          },
          "through_event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "checkpoint_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "Entry": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "entry_kind",
          "source_id",
          "event_sequence",
          "trust",
          "scope_generation",
          "source_visibility",
          "content_sha256"
        ],
        "properties": {
          "entry_kind": {
            "enum": [
              "user_message",
              "assistant_message",
              "tool_result",
              "pending_invocation",
              "decision",
              "summary"
            ]
          },
          "source_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "trust": {
            "description": "Source/trust label (P01-06): tool, upload, MCP and retrieval text is untrusted_data and can never act as policy or skill.",
            "enum": [
              "user_request",
              "assistant_output",
              "untrusted_data",
              "server_state"
            ]
          },
          "scope_generation": {
            "description": "P00-07 scope_generation of the source when the entry was admitted. On rebuild the entry is dropped if the source was deleted/revoked and re-read if the generation moved (context-reuse-rules.json entry_admission).",
            "$ref": "common.schema.json#/$defs/Generation"
          },
          "source_visibility": {
            "description": "Visibility of the entry's source (a conversation message has its conversation's visibility; a Memory item or upload its own). A summary takes the most restrictive visibility of its sources.",
            "$ref": "common.schema.json#/$defs/Visibility"
          },
          "share_decision_ref": {
            "description": "Explicit share decision (P00-07 content_access_grant or visibility_change id) that admits a private-source entry into a shared record.",
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "entry_kind": {
                  "const": "tool_result"
                }
              }
            },
            "then": {
              "properties": {
                "trust": {
                  "const": "untrusted_data"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "entry_kind": {
                  "const": "user_message"
                }
              }
            },
            "then": {
              "properties": {
                "trust": {
                  "const": "user_request"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "entry_kind": {
                  "enum": [
                    "pending_invocation",
                    "decision"
                  ]
                }
              }
            },
            "then": {
              "properties": {
                "trust": {
                  "const": "server_state"
                }
              }
            }
          }
        ]
      }
    }
  },
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json",
    "title": "assistant_runtime_common_v1",
    "description": "Shared scalar and enum definitions for the assistant-runtime v1 package. Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "EnvelopeId": {
        "description": "Billing spend envelope id; format owned by P00-10 (spend-envelope v1), mirrored here until cross-package $ref is allowed after Wave 0.",
        "type": "string",
        "pattern": "^env_[A-Za-z0-9_-]{3,64}$"
      },
      "AllocationId": {
        "description": "Billing allocation id; format owned by P00-10 (spend-envelope v1), mirrored here until cross-package $ref is allowed after Wave 0.",
        "type": "string",
        "pattern": "^alc_[A-Za-z0-9_-]{3,64}$"
      },
      "CompositionProjectId": {
        "description": "Composition project id of the Spark project entry (PR #294): private, tenant + owner scoped, cprj_<uuid>. P00-07 scope-grants and P00-10 use the same format.",
        "type": "string",
        "pattern": "^cprj_[0-9a-f-]{36}$"
      },
      "ModelId": {
        "description": "Public model catalog id (same shape as the current AssistantModelIdSchema).",
        "type": "string",
        "pattern": "^[A-Za-z0-9._:-]{1,128}$"
      },
      "CapabilityKey": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
        "maxLength": 128
      },
      "Sha256": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "Version": {
        "description": "Monotonic owner version counter used for CAS.",
        "type": "integer",
        "minimum": 0
      },
      "Revision": {
        "description": "Immutable revision number; the first revision is 1.",
        "type": "integer",
        "minimum": 1
      },
      "Generation": {
        "description": "P00-07 scope/grant generation of a source resource (scope-grants v1 Generation): every change of who may read the source increments it.",
        "type": "integer",
        "minimum": 1
      },
      "Visibility": {
        "description": "P00-07 resource visibility (scope-grants v1 Visibility): private = owner only, shared = owner + explicit grants.",
        "enum": [
          "private",
          "shared"
        ]
      },
      "EventSequence": {
        "description": "Durable conversation/run event ordinal (P01-15 cursor), never a wall-clock cutoff.",
        "type": "integer",
        "minimum": 0
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Surface": {
        "description": "Client surface that produced the message. Surface context never grants authority. `motion_authoring` (E1-H, additive v1) is the Motion screen's chat of one private Motion draft.",
        "enum": [
          "dashboard_chat",
          "spark_chat",
          "workflow_authoring",
          "motion_authoring"
        ]
      },
      "Mode": {
        "description": "Canonical execution mode name (KARAR-PLAN-QA-KAPANIS \u00a74, Q24/Q74). Legacy approval_mode=autonomous normalizes to auto. The mode/grant model itself is owned by P00-13 assistant schemas and P00-11.",
        "enum": [
          "ask",
          "auto",
          "auto_full"
        ]
      },
      "Channel": {
        "description": "Invocation channel; maps 1:1 to the P00-10 funding_channel value (TK-15).",
        "enum": [
          "app",
          "api",
          "mcp"
        ]
      },
      "JobStatus": {
        "description": "Normative owner-projection job_status (KARAR-PLAN-QA-KAPANIS \u00a73 + TK-03). waiting_input is the only input-wait status name (Q78); forbidden spellings are listed in field-dictionary.json.",
        "enum": [
          "draft",
          "preparing",
          "waiting_input",
          "plan_ready",
          "awaiting_g1",
          "funding_required",
          "admitted",
          "queued",
          "producing",
          "partial",
          "preview_ready",
          "awaiting_g2",
          "rendering",
          "completed",
          "failed",
          "canceled",
          "rejected",
          "expired"
        ]
      },
      "AttentionFlag": {
        "description": "Typed attention flags, separate from job_status (TK-03). funding_required is a job_status, not a flag.",
        "enum": [
          "sync_required",
          "fallback_used",
          "needs_connection",
          "unsupported_script",
          "admin_review"
        ]
      },
      "ApiFamily": {
        "description": "Provider protocol family of a native serializer (KARAR-COKLU-MODEL \u00a76).",
        "enum": [
          "openai_responses",
          "openai_chat_completions_compatible",
          "gemini_interactions",
          "gemini_generate_content",
          "anthropic_messages"
        ]
      },
      "OwnerBc": {
        "enum": [
          "assistant",
          "avatar",
          "billing",
          "brand",
          "composition",
          "connector",
          "memory",
          "provider",
          "review",
          "storage",
          "voice",
          "workflow"
        ]
      }
    }
  },
  "inference-execution-spec.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/inference-execution-spec.schema.json",
    "title": "inference_execution_spec_v1",
    "description": "Immutable spec of one LLM inference attempt (KARAR-COKLU-MODEL \u00a75). Pins exact job, model/backend/account scope, endpoint/serializer revision, settings version + model epoch, context epoch + context hash, tool schema, pricing, envelope/allocation and idempotency/attempt. A later settings or model change never re-prices or re-labels it; a model switch never changes mode or grant. Model switching implementation is P01A.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "execution_spec_id",
      "immutable",
      "job_id",
      "run_id",
      "logical_operation_id",
      "attempt_id",
      "idempotency_key",
      "invocation_cause_id",
      "model_ref",
      "api_family",
      "endpoint_revision",
      "serializer_revision",
      "account_scope_ref",
      "job_settings_version",
      "model_epoch",
      "canonical_context_id",
      "context_epoch",
      "context_hash",
      "through_event_sequence",
      "provider_appendix_id",
      "tool_schema_sha256",
      "pricing_revision",
      "envelope_id",
      "allocation_id",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "inference_execution_spec_v1"
      },
      "execution_spec_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "immutable": {
        "const": true
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "run_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "logical_operation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "attempt_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "idempotency_key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "invocation_cause_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "model_ref": {
        "$ref": "owner-refs.schema.json#/$defs/ModelCatalogRef"
      },
      "api_family": {
        "$ref": "common.schema.json#/$defs/ApiFamily"
      },
      "endpoint_revision": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "serializer_revision": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "account_scope_ref": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "region": {
        "type": "string",
        "pattern": "^[a-z0-9-]{2,32}$"
      },
      "job_settings_version": {
        "description": "P00-11 job_settings_version (Revision, starts at 1) at the time of the attempt.",
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "model_epoch": {
        "$ref": "common.schema.json#/$defs/Version"
      },
      "canonical_context_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "context_epoch": {
        "description": "context_epoch of the canonical context used by this attempt (K35). A retry under a newer epoch rebuilds and never re-sends the old provider_appendix_id.",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "context_hash": {
        "$ref": "common.schema.json#/$defs/Sha256"
      },
      "through_event_sequence": {
        "$ref": "common.schema.json#/$defs/EventSequence"
      },
      "provider_appendix_id": {
        "description": "Appendix reused for this attempt, or null for a cold rebuild from the canonical context.",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          {
            "type": "null"
          }
        ]
      },
      "tool_schema_sha256": {
        "$ref": "common.schema.json#/$defs/Sha256"
      },
      "pricing_revision": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "envelope_id": {
        "description": "Billing spend authorization envelope (owned by P00-10).",
        "$ref": "common.schema.json#/$defs/EnvelopeId"
      },
      "allocation_id": {
        "description": "Billing allocation of this attempt (owned by P00-10).",
        "$ref": "common.schema.json#/$defs/AllocationId"
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "invocation-cause.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/invocation-cause.schema.json",
    "title": "invocation_cause_v1",
    "description": "Server-derived cause/ref of a Chat or Workflow invocation. Written only by the gateway/worker from authenticated principal and durable records; never accepted from a browser, LLM output or tool result. Drives channel (app/api/mcp) and mode-table routing (Q74/Q79). Principal rules (final Wave 0 audit, 26 Sep 2026): a service principal always names on_behalf_of_user_id and only serves workflow_node, schedule, connector_webhook and system_recovery; a user principal never acts on behalf of another user; channel \u2194 principal follows P00-10 (app: user or service, api: personal_key or developer_app, mcp: mcp_client; service may recover or continue an api/mcp job). job-status-transitions.json principal_to_p00_10 maps the principal to the P00-10 envelope principal.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "invocation_cause_id",
      "derived_by",
      "cause_kind",
      "channel",
      "tenant_id",
      "principal",
      "derived_at"
    ],
    "properties": {
      "schema_version": {
        "const": "invocation_cause_v1"
      },
      "invocation_cause_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "derived_by": {
        "const": "server"
      },
      "cause_kind": {
        "enum": [
          "chat_message",
          "chat_reply",
          "review_decision",
          "workflow_node",
          "schedule",
          "api_request",
          "mcp_request",
          "connector_webhook",
          "system_recovery"
        ]
      },
      "channel": {
        "$ref": "common.schema.json#/$defs/Channel"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "principal": {
        "$ref": "#/$defs/Principal"
      },
      "surface": {
        "$ref": "common.schema.json#/$defs/Surface"
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "message_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "reply_binding_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "review_request_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "decision_version": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "workflow_run_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "node_uid": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "schedule_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "trigger_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "request_idempotency_key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "recovered_operation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "derived_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "cause_kind": {
              "const": "chat_message"
            }
          }
        },
        "then": {
          "required": [
            "surface",
            "conversation_id",
            "message_id"
          ],
          "properties": {
            "channel": {
              "const": "app"
            },
            "principal": {
              "properties": {
                "principal_kind": {
                  "const": "user"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "cause_kind": {
              "const": "chat_reply"
            }
          }
        },
        "then": {
          "required": [
            "surface",
            "conversation_id",
            "message_id",
            "reply_binding_id",
            "job_id"
          ],
          "properties": {
            "channel": {
              "const": "app"
            },
            "principal": {
              "properties": {
                "principal_kind": {
                  "const": "user"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "cause_kind": {
              "const": "review_decision"
            }
          }
        },
        "then": {
          "required": [
            "review_request_id",
            "decision_version",
            "job_id"
          ],
          "properties": {
            "channel": {
              "const": "app"
            },
            "principal": {
              "properties": {
                "principal_kind": {
                  "const": "user"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "cause_kind": {
              "const": "workflow_node"
            }
          }
        },
        "then": {
          "required": [
            "workflow_run_id",
            "node_uid"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "cause_kind": {
              "const": "schedule"
            }
          }
        },
        "then": {
          "required": [
            "schedule_id"
          ],
          "properties": {
            "channel": {
              "const": "app"
            },
            "principal": {
              "properties": {
                "principal_kind": {
                  "const": "service"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "cause_kind": {
              "const": "api_request"
            }
          }
        },
        "then": {
          "required": [
            "request_idempotency_key"
          ],
          "properties": {
            "channel": {
              "const": "api"
            },
            "principal": {
              "properties": {
                "principal_kind": {
                  "enum": [
                    "personal_key",
                    "developer_app"
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
            "cause_kind": {
              "const": "mcp_request"
            }
          }
        },
        "then": {
          "required": [
            "request_idempotency_key"
          ],
          "properties": {
            "channel": {
              "const": "mcp"
            },
            "principal": {
              "properties": {
                "principal_kind": {
                  "const": "mcp_client"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "cause_kind": {
              "const": "connector_webhook"
            }
          }
        },
        "then": {
          "required": [
            "trigger_id"
          ],
          "properties": {
            "channel": {
              "const": "app"
            },
            "principal": {
              "properties": {
                "principal_kind": {
                  "const": "service"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "cause_kind": {
              "const": "system_recovery"
            }
          }
        },
        "then": {
          "required": [
            "recovered_operation_id",
            "job_id"
          ],
          "properties": {
            "principal": {
              "properties": {
                "principal_kind": {
                  "const": "service"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "channel": {
              "const": "app"
            }
          },
          "required": [
            "channel"
          ]
        },
        "then": {
          "properties": {
            "principal": {
              "properties": {
                "principal_kind": {
                  "enum": [
                    "user",
                    "service"
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
            "channel": {
              "const": "api"
            }
          },
          "required": [
            "channel"
          ]
        },
        "then": {
          "properties": {
            "principal": {
              "properties": {
                "principal_kind": {
                  "enum": [
                    "personal_key",
                    "developer_app",
                    "service"
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
            "channel": {
              "const": "mcp"
            }
          },
          "required": [
            "channel"
          ]
        },
        "then": {
          "properties": {
            "principal": {
              "properties": {
                "principal_kind": {
                  "enum": [
                    "mcp_client",
                    "service"
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
            "principal": {
              "properties": {
                "principal_kind": {
                  "const": "service"
                }
              },
              "required": [
                "principal_kind"
              ]
            }
          },
          "required": [
            "principal"
          ]
        },
        "then": {
          "properties": {
            "cause_kind": {
              "enum": [
                "workflow_node",
                "schedule",
                "connector_webhook",
                "system_recovery"
              ]
            }
          }
        }
      }
    ],
    "$defs": {
      "Principal": {
        "description": "Authenticated principal as resolved by the gateway. For service principals acting for a user, on_behalf_of_user_id is the user whose grant is used.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "principal_kind",
          "principal_id"
        ],
        "properties": {
          "principal_kind": {
            "description": "user (app), personal_key or developer_app (api), mcp_client (mcp) per DEVELOPER-PLATFORM \u00a76.1 and P00-10; service for internal workers acting on_behalf_of a user.",
            "enum": [
              "user",
              "personal_key",
              "developer_app",
              "mcp_client",
              "service"
            ]
          },
          "principal_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "on_behalf_of_user_id": {
            "description": "service: the user whose grant is used (required). personal_key/developer_app/mcp_client: the delegated user when the credential acts for one (DEVELOPER-PLATFORM delegated_actor_id). Never present for a user principal.",
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "principal_kind": {
                  "const": "service"
                }
              },
              "required": [
                "principal_kind"
              ]
            },
            "then": {
              "required": [
                "on_behalf_of_user_id"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "principal_kind": {
                  "const": "user"
                }
              },
              "required": [
                "principal_kind"
              ]
            },
            "then": {
              "not": {
                "required": [
                  "on_behalf_of_user_id"
                ]
              }
            }
          }
        ]
      }
    }
  },
  "job-cancel-command.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/job-cancel-command.schema.json",
    "title": "job_cancel_command_v1",
    "description": "Explicit cancel of exactly one job (K65, MIMARI \u00a72 'Explicit iptal', Q76/Q91). Cancel is a command, never a chat-message relation. The actor is the server-derived principal and must be the job's initiator (a tenant role or another member of a shared conversation is not enough). The initiator can always cancel their own non-terminal job: a stale expected_job_version is reported, never a rejection; a terminal job is never revived; the same idempotency key has a single effect. Other jobs, their approvals, grants and envelopes are untouched; accepted remote work drains under runtime_terminal (P00-11 recovery_only). Ordered checks and scenarios: job-status-transitions.json cancel_command.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "command_id",
      "idempotency_key",
      "conversation_id",
      "job_id",
      "expected_job_version",
      "actor",
      "issued_at"
    ],
    "properties": {
      "schema_version": {
        "const": "job_cancel_command_v1"
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
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "expected_job_version": {
        "description": "job_version the client saw (job-version-vector job_version). A newer version never blocks the cancel; the result reports observed_job_version.",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "actor": {
        "description": "Server-derived principal (gateway), never from the request body.",
        "$ref": "invocation-cause.schema.json#/$defs/Principal"
      },
      "issued_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "job-projection.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/job-projection.schema.json",
    "title": "job_projection_v1",
    "description": "Owner projection of one business job. job_status is the single normative state machine (job-status-transitions.json); stage is a user-visible sub-step and never replaces status; attention is a separate typed flag list. Runtime terminal, finance settlement and artifact delivery are three separate fields; the user-facing 'completed' view is derived from them (completion-view-derivation.json). TTL values are config (job-status-transitions.json config_defaults), not schema constants.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "job_id",
      "conversation_id",
      "job_status",
      "attention",
      "mode",
      "production_plan_revision",
      "versions",
      "envelope_id",
      "runtime_terminal",
      "finance_settlement",
      "artifact_delivery",
      "event_cursor",
      "updated_at"
    ],
    "properties": {
      "schema_version": {
        "const": "job_projection_v1"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_status": {
        "$ref": "common.schema.json#/$defs/JobStatus"
      },
      "resume_status": {
        "description": "Status to return to when a waiting_input/funding_required hold is resolved ('\u00f6nceki aktif durum'). plan_ready is a funding_required source by coordinator decision (F39). rendering is a funding_required source by the final Wave 0 audit decision (F39 for the final render allocation). awaiting_g1, preview_ready and awaiting_g2 are funding_required sources by the money/mode audit decision (K55 re-evaluation, export-time funding).",
        "enum": [
          "plan_ready",
          "preparing",
          "awaiting_g1",
          "admitted",
          "queued",
          "producing",
          "preview_ready",
          "awaiting_g2",
          "rendering"
        ]
      },
      "funding_reason": {
        "description": "Mapped from the P00-10 decision (job-status-transitions.json spend_decision_mapping). balance_insufficient: R04 funding_required / allocation wait_funding (top-up card). grant_insufficient: allocation wait_authorization / wait_ceiling, principal cap, and reestimate ask_once in production (Q73: an amount approval, not a top-up; pending approval_request with approval_kind=g1). ask_once at G1 maps to awaiting_g1, not here.",
        "enum": [
          "balance_insufficient",
          "grant_insufficient"
        ]
      },
      "cancel_reason": {
        "description": "Why a canceled job was canceled: user_cancel, or schedule_skipped_insufficient_balance (Q79 skip_run; owner is notified).",
        "enum": [
          "user_cancel",
          "schedule_skipped_insufficient_balance"
        ]
      },
      "stage": {
        "oneOf": [
          {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          },
          {
            "type": "null"
          }
        ]
      },
      "attention": {
        "type": "array",
        "maxItems": 5,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/AttentionFlag"
        }
      },
      "mode": {
        "$ref": "common.schema.json#/$defs/Mode"
      },
      "production_plan_revision": {
        "description": "Job projection plan revision (not Feature Control subscription_plan_revision).",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Revision"
          },
          {
            "type": "null"
          }
        ]
      },
      "versions": {
        "$ref": "job-version-vector.schema.json"
      },
      "envelope_id": {
        "description": "Billing spend authorization envelope id (P00-10 owns the envelope and its amounts).",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/EnvelopeId"
          },
          {
            "type": "null"
          }
        ]
      },
      "expires_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "render_retry_count": {
        "type": "integer",
        "minimum": 0
      },
      "runtime_terminal": {
        "$ref": "#/$defs/RuntimeTerminal"
      },
      "finance_settlement": {
        "$ref": "#/$defs/FinanceSettlement"
      },
      "artifact_delivery": {
        "$ref": "#/$defs/ArtifactDelivery"
      },
      "event_cursor": {
        "$ref": "common.schema.json#/$defs/EventSequence"
      },
      "updated_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "job_status": {
              "const": "funding_required"
            }
          }
        },
        "then": {
          "required": [
            "resume_status",
            "funding_reason",
            "expires_at"
          ],
          "properties": {
            "resume_status": {
              "enum": [
                "plan_ready",
                "preparing",
                "awaiting_g1",
                "admitted",
                "queued",
                "producing",
                "preview_ready",
                "awaiting_g2",
                "rendering"
              ]
            }
          }
        },
        "else": {
          "not": {
            "required": [
              "funding_reason"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "job_status": {
              "const": "waiting_input"
            }
          }
        },
        "then": {
          "required": [
            "resume_status",
            "expires_at"
          ],
          "properties": {
            "resume_status": {
              "enum": [
                "preparing",
                "producing"
              ]
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "job_status": {
              "not": {
                "enum": [
                  "funding_required",
                  "waiting_input"
                ]
              }
            }
          }
        },
        "then": {
          "not": {
            "required": [
              "resume_status"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "job_status": {
              "const": "canceled"
            }
          }
        },
        "then": {
          "required": [
            "cancel_reason"
          ]
        },
        "else": {
          "not": {
            "required": [
              "cancel_reason"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "job_status": {
              "enum": [
                "awaiting_g1",
                "awaiting_g2"
              ]
            }
          }
        },
        "then": {
          "required": [
            "expires_at"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "job_status": {
              "not": {
                "enum": [
                  "waiting_input",
                  "funding_required",
                  "awaiting_g1",
                  "awaiting_g2"
                ]
              }
            }
          }
        },
        "then": {
          "not": {
            "required": [
              "expires_at"
            ]
          }
        }
      },
      {
        "if": {
          "required": [
            "stage"
          ],
          "properties": {
            "stage": {
              "const": "capacity_wait"
            }
          }
        },
        "then": {
          "properties": {
            "job_status": {
              "enum": [
                "preparing",
                "queued",
                "producing",
                "rendering"
              ]
            }
          }
        }
      }
    ],
    "$defs": {
      "RuntimeTerminal": {
        "description": "Execution runtime state across the job's runs/operations. canceled job_status does not end drain/recovery of accepted remote work.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "state",
          "as_of_event_sequence"
        ],
        "properties": {
          "state": {
            "enum": [
              "not_started",
              "open",
              "draining",
              "outcome_unknown",
              "succeeded",
              "failed",
              "canceled"
            ]
          },
          "as_of_event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          }
        }
      },
      "FinanceSettlement": {
        "description": "Settlement state of the job's allocations in the P00-10 envelope (amounts stay in Billing), derived by finance-settlement-derivation.json: outcome_unknown > open (authorized/dispatched) > settled (settled/abandoned/released) > none (no allocation). Quota-only 0-credit allocations follow their own status: settled once terminal, open while authorized/dispatched.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "state",
          "as_of_event_sequence"
        ],
        "properties": {
          "state": {
            "enum": [
              "none",
              "open",
              "outcome_unknown",
              "settled"
            ]
          },
          "as_of_event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          }
        }
      },
      "ArtifactDelivery": {
        "description": "Delivery of the job's result artifacts to the user (Storage readiness + owner apply + visible). Provider done alone is not delivery.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "state",
          "delivered_refs",
          "as_of_event_sequence"
        ],
        "properties": {
          "state": {
            "enum": [
              "not_applicable",
              "pending",
              "partial",
              "delivered",
              "failed"
            ]
          },
          "delivered_refs": {
            "type": "array",
            "maxItems": 64,
            "items": {
              "$ref": "owner-refs.schema.json"
            }
          },
          "as_of_event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          }
        }
      }
    }
  },
  "job-version-vector.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/job-version-vector.schema.json",
    "title": "job_version_vector_v1",
    "description": "Separate version counters of one job. They never merge: settings/model epoch (D03/D04, P00-11), durable grant, Billing approval, semantic Review decision and Review card delivery/routing are distinct. Which counters enter the approval fingerprint is fixed in version-separation.json.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "job_version",
      "job_settings_version",
      "conversation_defaults_version",
      "model_epoch",
      "grant_version",
      "approval_version",
      "decision_version",
      "delivery_version"
    ],
    "properties": {
      "job_version": {
        "description": "Job aggregate CAS version; target of job_target.expected_job_version.",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "job_settings_version": {
        "description": "Effective job settings version; CAS field expected_job_settings_version (P00-11). Revision: starts at 1, same as P00-11 job_settings_v1 (final Wave 0 audit).",
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "conversation_defaults_version": {
        "description": "New-job defaults version of the conversation; CAS field expected_conversation_defaults_version (P00-11).",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "model_epoch": {
        "description": "Increments when a pending planner model switch becomes effective at a safe inference boundary.",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "grant_version": {
        "description": "Durable execution grant snapshot version. Mirror of approval_version (grant_version := approval_version of the job's P00-10 envelope, 0 when approval_version is null); P00-11 GrantSnapshot.grant_version carries the same value (record-invariants.json inv_grant_version_mirrors_approval_version).",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "approval_version": {
        "description": "Billing envelope approval version (P00-10). null: no envelope yet; 0: envelope exists but no grant yet (same meaning as P00-10); >=1: current ceiling version.",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Version"
          },
          {
            "type": "null"
          }
        ]
      },
      "decision_version": {
        "description": "Semantic version of the current/last canonical Review decision request; null when none.",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Revision"
          },
          {
            "type": "null"
          }
        ]
      },
      "delivery_version": {
        "description": "Review card delivery/routing/presence version (inline vs. inbox promotion). Never semantic, never in the approval fingerprint.",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Version"
          },
          {
            "type": "null"
          }
        ]
      }
    }
  },
  "owner-refs.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json",
    "title": "owner_ref_v1",
    "description": "Typed owner-specific reference union (MIMARI \u00a75.3). Each ref names its owner's own immutable version field; there is no universal revision_id. A visible label is never the identity or an authority; the owner resolver re-validates access on every dispatch. P00-03 owns these field names; P00-07 scope-grants and later packages reuse them (coordinator decision 26 Sep 2026).",
    "oneOf": [
      {
        "$ref": "#/$defs/SkillRevisionRef"
      },
      {
        "$ref": "#/$defs/CapabilityRef"
      },
      {
        "$ref": "#/$defs/ConnectorToolRef"
      },
      {
        "$ref": "#/$defs/ConnectedAccountRef"
      },
      {
        "$ref": "#/$defs/BrandRevisionRef"
      },
      {
        "$ref": "#/$defs/StorageObjectRef"
      },
      {
        "$ref": "#/$defs/ModelCatalogRef"
      },
      {
        "$ref": "#/$defs/AvatarRef"
      },
      {
        "$ref": "#/$defs/VoiceProfileRef"
      }
    ],
    "$defs": {
      "SkillRevisionRef": {
        "description": "Assistant-owned skill revision pinned by revision + body digest (MIMARI \u00a73). Owner: Assistant (P01D catalog).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "skill_id",
          "skill_revision_id",
          "skill_scope",
          "body_digest_sha256"
        ],
        "properties": {
          "ref_type": {
            "const": "skill_revision"
          },
          "skill_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "skill_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "skill_scope": {
            "enum": [
              "system_internal",
              "platform",
              "workspace",
              "personal"
            ]
          },
          "body_digest_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "CapabilityRef": {
        "description": "Abstract capability requirement. Carries no OAuth scope, credential, vendor tool id, mode or credit authority; the owning BC resolves it.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "capability_key",
          "owner_bc"
        ],
        "properties": {
          "ref_type": {
            "const": "capability"
          },
          "capability_key": {
            "$ref": "common.schema.json#/$defs/CapabilityKey"
          },
          "owner_bc": {
            "$ref": "common.schema.json#/$defs/OwnerBc"
          },
          "capability_revision": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "ConnectorToolRef": {
        "description": "Exact Connector tool revision. Remote metadata revision is not an execution pin (R03). Owner: Connector (P01C-24 refines field names after Wave 0).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "connector_definition_id",
          "tool_name",
          "tool_revision_id"
        ],
        "properties": {
          "ref_type": {
            "const": "connector_tool"
          },
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
      },
      "ConnectedAccountRef": {
        "description": "Connected account (connection) reference. Secret-free: no token, scope or grant; ConnectionGrant is checked by Connector at dispatch.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "connector_definition_id",
          "connection_id",
          "connection_revision"
        ],
        "properties": {
          "ref_type": {
            "const": "connected_account"
          },
          "connector_definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "connection_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "connection_revision": {
            "$ref": "common.schema.json#/$defs/Version"
          }
        }
      },
      "BrandRevisionRef": {
        "description": "Brand immutable revision of a Kit/Element/Template/Motion definition, pinned by revision id + revision digest (P00-07 dependency pinning uses these names). Owner: Brand.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "brand_asset_kind",
          "brand_asset_id",
          "brand_revision_id",
          "brand_revision_digest_sha256"
        ],
        "properties": {
          "ref_type": {
            "const": "brand_revision"
          },
          "brand_asset_kind": {
            "enum": [
              "kit",
              "element",
              "template",
              "motion"
            ]
          },
          "brand_asset_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "brand_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "brand_revision_digest_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "StorageObjectRef": {
        "description": "Storage object + checksum. A signed URL or file name is never a reference. Owner: Storage.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "ref_type": {
            "const": "storage_object"
          },
          "storage_object_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "checksum_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          },
          "media_kind": {
            "enum": [
              "video",
              "image",
              "audio",
              "document",
              "other"
            ]
          },
          "byte_size": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "ModelCatalogRef": {
        "description": "Provider model catalog entry + capability revision. A client label or public alias alone is not the effective model.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "model_id",
          "model_catalog_revision",
          "capability_key",
          "capability_revision"
        ],
        "properties": {
          "ref_type": {
            "const": "model_catalog"
          },
          "model_id": {
            "$ref": "common.schema.json#/$defs/ModelId"
          },
          "model_catalog_revision": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "capability_key": {
            "$ref": "common.schema.json#/$defs/CapabilityKey"
          },
          "capability_revision": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "AvatarRef": {
        "description": "Existing Avatar owner version (+ optional execution snapshot pinned by the owner at execution). No avatar_revision_id is invented.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "avatar_id",
          "avatar_version"
        ],
        "properties": {
          "ref_type": {
            "const": "avatar"
          },
          "avatar_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "avatar_version": {
            "$ref": "common.schema.json#/$defs/Version"
          },
          "execution_snapshot_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "execution_snapshot_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        },
        "dependentRequired": {
          "execution_snapshot_id": [
            "execution_snapshot_sha256"
          ],
          "execution_snapshot_sha256": [
            "execution_snapshot_id"
          ]
        }
      },
      "VoiceProfileRef": {
        "description": "Existing Voice profile owner version (+ optional execution snapshot of the resolved binding route).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "voice_profile_id",
          "voice_profile_version"
        ],
        "properties": {
          "ref_type": {
            "const": "voice_profile"
          },
          "voice_profile_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "voice_profile_version": {
            "$ref": "common.schema.json#/$defs/Version"
          },
          "execution_snapshot_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "execution_snapshot_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        },
        "dependentRequired": {
          "execution_snapshot_id": [
            "execution_snapshot_sha256"
          ],
          "execution_snapshot_sha256": [
            "execution_snapshot_id"
          ]
        }
      },
      "InvocationTargetRef": {
        "description": "What a tool invocation targets: an internal owner capability or an exact Connector tool revision.",
        "oneOf": [
          {
            "$ref": "#/$defs/CapabilityRef"
          },
          {
            "$ref": "#/$defs/ConnectorToolRef"
          }
        ]
      }
    }
  },
  "pending-invocation.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/pending-invocation.schema.json",
    "title": "pending_invocation_v1",
    "description": "A durable, versioned wait point of one job step (missing input, human decision or connection). Exactly one reply can bind to an open version; answering never opens a second independent run (K05). The question object itself (single question, field key, <=4 options) is owned by P00-13. Only awaiting_user_id can answer (final Wave 0 audit, coordinator decision 26 Sep 2026: in a shared conversation only the user who started the job answers its waits).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "pending_invocation_id",
      "version",
      "conversation_id",
      "job_id",
      "run_id",
      "step_id",
      "awaiting_user_id",
      "kind",
      "state",
      "prompt_message_id",
      "expires_at",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "pending_invocation_v1"
      },
      "pending_invocation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "version": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "run_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "step_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "awaiting_user_id": {
        "description": "The only user whose reply can bind: the job's initiating user (for API/MCP jobs the user the principal acts for; POST /jobs/{id}/inputs and provide_job_input authenticate that principal). A tenant role or another conversation member never answers it.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "kind": {
        "enum": [
          "input_request",
          "approval_request",
          "connection_request"
        ]
      },
      "state": {
        "enum": [
          "open",
          "answered",
          "superseded",
          "expired",
          "canceled"
        ]
      },
      "prompt_message_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "required_field_keys": {
        "description": "All missing required fields in one multi-field form (TK-37).",
        "type": "array",
        "minItems": 1,
        "maxItems": 32,
        "uniqueItems": true,
        "items": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]{0,63}$"
        }
      },
      "review_request_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "approval_kind": {
        "enum": [
          "g1",
          "g2",
          "external_action"
        ]
      },
      "connection_requirement_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "answered_by_reply_binding_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "expires_at": {
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
            "kind": {
              "const": "input_request"
            }
          }
        },
        "then": {
          "required": [
            "required_field_keys"
          ],
          "not": {
            "anyOf": [
              {
                "required": [
                  "review_request_id"
                ]
              },
              {
                "required": [
                  "approval_kind"
                ]
              },
              {
                "required": [
                  "connection_requirement_id"
                ]
              }
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "kind": {
              "const": "approval_request"
            }
          }
        },
        "then": {
          "required": [
            "review_request_id",
            "approval_kind"
          ],
          "not": {
            "anyOf": [
              {
                "required": [
                  "required_field_keys"
                ]
              },
              {
                "required": [
                  "connection_requirement_id"
                ]
              }
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "kind": {
              "const": "connection_request"
            }
          }
        },
        "then": {
          "required": [
            "connection_requirement_id"
          ],
          "not": {
            "anyOf": [
              {
                "required": [
                  "required_field_keys"
                ]
              },
              {
                "required": [
                  "review_request_id"
                ]
              },
              {
                "required": [
                  "approval_kind"
                ]
              }
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "state": {
              "const": "answered"
            }
          }
        },
        "then": {
          "required": [
            "answered_by_reply_binding_id"
          ]
        },
        "else": {
          "not": {
            "required": [
              "answered_by_reply_binding_id"
            ]
          }
        }
      }
    ]
  },
  "provider-protocol-appendix.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/provider-protocol-appendix.schema.json",
    "title": "provider_protocol_appendix_v1",
    "description": "Provider-private side record (native call ids, response/interaction ids, opaque reasoning/signature/compaction blocks, cached-content handles) kept verbatim for one API family + lineage. Never converted into logs, Memory or skill text and never replayed to another API family; cross-family switches rebuild from the canonical context (KARAR-COKLU-MODEL \u00a73/\u00a76). K35: reusable only under the same context_epoch as the current canonical context; after a revoke/delete/update bumps the epoch every native state kind (cached_content_handle and native_compaction_block included) is refused and the attempt rebuilds cold (context-reuse-rules.json).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "appendix_id",
      "canonical_context_id",
      "context_epoch",
      "lineage_id",
      "api_family",
      "model_ref",
      "serializer_revision",
      "account_scope_ref",
      "covered_through_event_sequence",
      "native_state_kind",
      "opaque_payload_ref",
      "opaque_payload_sha256",
      "reuse_policy",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "provider_protocol_appendix_v1"
      },
      "appendix_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "canonical_context_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "context_epoch": {
        "description": "context_epoch of the canonical context this native state was built from; a newer epoch never reuses it.",
        "$ref": "common.schema.json#/$defs/Version"
      },
      "lineage_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "api_family": {
        "$ref": "common.schema.json#/$defs/ApiFamily"
      },
      "model_ref": {
        "$ref": "owner-refs.schema.json#/$defs/ModelCatalogRef"
      },
      "serializer_revision": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "account_scope_ref": {
        "description": "Opaque provider account/credential-pool scope id. Never a key or token.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "region": {
        "type": "string",
        "pattern": "^[a-z0-9-]{2,32}$"
      },
      "covered_through_event_sequence": {
        "$ref": "common.schema.json#/$defs/EventSequence"
      },
      "native_state_kind": {
        "enum": [
          "response_id",
          "encrypted_reasoning_item",
          "thought_signature",
          "cached_content_handle",
          "native_compaction_block",
          "native_tool_call_ids"
        ]
      },
      "opaque_payload_ref": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "opaque_payload_sha256": {
        "$ref": "common.schema.json#/$defs/Sha256"
      },
      "reuse_policy": {
        "const": "same_api_family_and_lineage_with_verified_suffix"
      },
      "expires_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "reply-binding.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/reply-binding.schema.json",
    "title": "reply_binding_v1",
    "description": "Server-derived result of binding a user message to a pending invocation (K05/K65, F17a). Only resolution=bound continues the pending step; stale or ambiguous targets never fall back to a global or new-job interpretation. Only the pending invocation's awaiting_user_id can bind (not_awaited_user otherwise; record-invariants.json inv_bound_reply_comes_from_awaited_user).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "reply_binding_id",
      "derived_by",
      "conversation_id",
      "message_id",
      "replying_user_id",
      "binding_source",
      "resolution",
      "resolved_at"
    ],
    "properties": {
      "schema_version": {
        "const": "reply_binding_v1"
      },
      "reply_binding_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "derived_by": {
        "const": "server"
      },
      "conversation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "message_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "replying_user_id": {
        "description": "Server-derived author of the message (never from the body).",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "awaiting_user_id": {
        "description": "awaiting_user_id of the targeted pending invocation.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "binding_source": {
        "description": "explicit_reply: message carried reply_to; single_open_pending: the replying user is the awaiting user of exactly one open pending invocation in the conversation (candidates awaiting other users never count); mention: message referenced the card.",
        "enum": [
          "explicit_reply",
          "single_open_pending",
          "mention"
        ]
      },
      "resolution": {
        "enum": [
          "bound",
          "stale_version",
          "target_not_open",
          "not_awaited_user",
          "ambiguous_target"
        ]
      },
      "job_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "pending_invocation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "expected_pending_version": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "observed_pending_version": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "candidate_job_ids": {
        "type": "array",
        "minItems": 2,
        "maxItems": 16,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/OpaqueId"
        }
      },
      "resolved_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "resolution": {
              "const": "bound"
            }
          }
        },
        "then": {
          "required": [
            "job_id",
            "pending_invocation_id",
            "awaiting_user_id",
            "expected_pending_version",
            "observed_pending_version"
          ],
          "not": {
            "required": [
              "candidate_job_ids"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "resolution": {
              "enum": [
                "stale_version",
                "target_not_open"
              ]
            }
          }
        },
        "then": {
          "required": [
            "job_id",
            "pending_invocation_id",
            "awaiting_user_id",
            "expected_pending_version",
            "observed_pending_version"
          ],
          "not": {
            "required": [
              "candidate_job_ids"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "resolution": {
              "const": "not_awaited_user"
            }
          }
        },
        "then": {
          "required": [
            "job_id",
            "pending_invocation_id",
            "awaiting_user_id"
          ],
          "not": {
            "required": [
              "candidate_job_ids"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "resolution": {
              "const": "ambiguous_target"
            }
          }
        },
        "then": {
          "required": [
            "candidate_job_ids"
          ],
          "not": {
            "anyOf": [
              {
                "required": [
                  "job_id"
                ]
              },
              {
                "required": [
                  "pending_invocation_id"
                ]
              },
              {
                "required": [
                  "awaiting_user_id"
                ]
              }
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "binding_source": {
              "const": "explicit_reply"
            }
          }
        },
        "then": {
          "required": [
            "expected_pending_version"
          ],
          "properties": {
            "resolution": {
              "not": {
                "const": "ambiguous_target"
              }
            }
          }
        }
      }
    ]
  },
  "tool-result.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/tool-result.schema.json",
    "title": "tool_result_v1",
    "description": "Tool result union persisted as a durable observation. Tool output is always untrusted data, never policy or skill. logical_operation_id is ours; provider native call ids live only in the provider protocol appendix and never replace it. A completion recorded after the trigger message is still part of planning context via event_sequence (K50).",
    "oneOf": [
      {
        "$ref": "#/$defs/SucceededResult"
      },
      {
        "$ref": "#/$defs/AcceptedAsyncResult"
      },
      {
        "$ref": "#/$defs/NeedsInputResult"
      },
      {
        "$ref": "#/$defs/NeedsApprovalResult"
      },
      {
        "$ref": "#/$defs/NeedsConnectionResult"
      },
      {
        "$ref": "#/$defs/RejectedResult"
      },
      {
        "$ref": "#/$defs/FailedResult"
      },
      {
        "$ref": "#/$defs/OutcomeUnknownResult"
      },
      {
        "$ref": "#/$defs/AbandonedResult"
      },
      {
        "$ref": "#/$defs/CanceledResult"
      }
    ],
    "$defs": {
      "SucceededResult": {
        "title": "tool_result_succeeded",
        "description": "Owner accepted and completed the operation; outputs are owner refs (never raw URLs).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "receipt_id",
          "output_refs"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "succeeded"
          },
          "receipt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "output_refs": {
            "type": "array",
            "maxItems": 64,
            "items": {
              "$ref": "owner-refs.schema.json"
            }
          },
          "summary_text": {
            "type": "string",
            "maxLength": 2000
          }
        }
      },
      "AcceptedAsyncResult": {
        "title": "tool_result_accepted_async",
        "description": "Owner accepted a long-running operation; completion arrives later as a new tool result. The async tool contract (operation ref + join point) is owned by P00-13.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "operation_owner_bc",
          "operation_id"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "accepted_async"
          },
          "operation_owner_bc": {
            "$ref": "common.schema.json#/$defs/OwnerBc"
          },
          "operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "NeedsInputResult": {
        "title": "tool_result_needs_input",
        "description": "Required input is missing; the step waits on a pending invocation (job_status waiting_input).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "pending_invocation_id"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "needs_input"
          },
          "pending_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "NeedsApprovalResult": {
        "title": "tool_result_needs_approval",
        "description": "Human decision required; one canonical Review request shared by Chat and Inbox.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "pending_invocation_id",
          "review_request_id"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "needs_approval"
          },
          "pending_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "review_request_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "NeedsConnectionResult": {
        "title": "tool_result_needs_connection",
        "description": "Connector-backed capability is not usable yet (P01C/P03-18 card).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "connection_requirement_id",
          "reason_code"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "needs_connection"
          },
          "connection_requirement_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "reason_code": {
            "enum": [
              "needs_connection",
              "connection_disabled",
              "reauth_required",
              "scope_required",
              "resource_selection_required"
            ]
          }
        }
      },
      "RejectedResult": {
        "title": "tool_result_rejected",
        "description": "Refused before any external effect or stream start: no charge (Y3).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "reason_code",
          "charged"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "rejected"
          },
          "reason_code": {
            "enum": [
              "forbidden",
              "feature_unavailable",
              "validation_failed",
              "policy_denied",
              "rate_limited",
              "tool_revision_changed",
              "source_version_changed",
              "unsupported_protocol"
            ]
          },
          "charged": {
            "const": false
          }
        }
      },
      "FailedResult": {
        "title": "tool_result_failed",
        "description": "Definite failure with a safe error code. retryable=true only when no accepted external effect exists.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "error_code",
          "retryable"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "failed"
          },
          "error_code": {
            "type": "string",
            "pattern": "^[A-Za-z0-9_.:-]{1,64}$"
          },
          "retryable": {
            "type": "boolean"
          },
          "receipt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "OutcomeUnknownResult": {
        "title": "tool_result_outcome_unknown",
        "description": "Accepted or possibly accepted, result unknown. Never blind-retried; reconciliation by logical_operation_id/remote id.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "reconciliation_required"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "outcome_unknown"
          },
          "reconciliation_required": {
            "const": true
          },
          "receipt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "remote_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "AbandonedResult": {
        "title": "tool_result_abandoned",
        "description": "Deliberately cut by us (TK-16); not uncertain. Settled by provider-reported usage or the reserved estimate; a new attempt takes a new allocation.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "abandon_reason",
          "settlement_basis"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "abandoned"
          },
          "abandon_reason": {
            "enum": [
              "user_cancel",
              "lane_b_cancel",
              "context_limit_summarize",
              "supplier_switch"
            ]
          },
          "settlement_basis": {
            "enum": [
              "provider_reported_usage",
              "reserved_estimate"
            ]
          }
        }
      },
      "CanceledResult": {
        "title": "tool_result_canceled",
        "description": "Cancel outcome. cancel_confirmed=false means only a cancel request was sent (not a verified stop).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "tool_invocation_id",
          "logical_operation_id",
          "attempt_id",
          "job_id",
          "run_id",
          "step_id",
          "tool_ref",
          "invocation_cause_id",
          "content_trust",
          "event_sequence",
          "recorded_at",
          "status",
          "cancel_confirmed"
        ],
        "properties": {
          "schema_version": {
            "const": "tool_result_v1"
          },
          "tool_invocation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "logical_operation_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "attempt_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "job_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "run_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_ref": {
            "$ref": "owner-refs.schema.json#/$defs/InvocationTargetRef"
          },
          "invocation_cause_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "content_trust": {
            "const": "untrusted_data"
          },
          "event_sequence": {
            "$ref": "common.schema.json#/$defs/EventSequence"
          },
          "recorded_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "status": {
            "const": "canceled"
          },
          "cancel_confirmed": {
            "type": "boolean"
          }
        }
      }
    }
  }
} as const;

// Foreign schema files reached through cross-package $refs, embedded verbatim
// from their owner package and registered next to SCHEMAS.
export const DEPENDENCY_SCHEMAS = {
  "motion-spark/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json",
    "title": "Motion/Spark v1 -- shared definitions",
    "description": "Shared ids, enums and small value types reused across the motion-spark v1 package (P00-13, Dalga 0 freeze). Motion IR itself (nodes/tracks/anchors), CompositionDocument, revision and RenderManifest are owned by P00-04 (composition-project v1) and are referenced here by name/text only, never redefined. cprj_ composition project ids are owned by P00-07/P00-04 (scope-grants v1 common.schema.json CompositionProjectId, merged to main in train #301); referenced by $ref per Dalga 0 acceptance ($ref between main packages is now allowed, K318).",
    "$defs": {
      "CompositionProjectId": {
        "$ref": "../../scope-grants/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "Handle": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*#[0-9]+$",
        "description": "TK-23: deterministically derived from the blueprint's role + order + slot key (e.g. title#1, stat#2). Never author-assigned; never reused across an unrelated node after deletion."
      },
      "FrameIndex": {
        "type": "integer",
        "minimum": 0,
        "description": "Integer render frame index. Motion IR has no live ticker (F40); everything resolves to a frame index at compile time."
      },
      "Anchor": {
        "description": "A timed window start, resolved to an integer frame at compile time (MOTOR SS2 'anchors').",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "frames"
            ],
            "properties": {
              "kind": {
                "const": "scene_offset"
              },
              "frames": {
                "type": "integer",
                "minimum": 0
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "word_id"
            ],
            "properties": {
              "kind": {
                "const": "word"
              },
              "word_id": {
                "type": "string",
                "minLength": 1
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "index"
            ],
            "properties": {
              "kind": {
                "const": "beat"
              },
              "index": {
                "type": "integer",
                "minimum": 0
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "handle"
            ],
            "properties": {
              "kind": {
                "const": "after"
              },
              "handle": {
                "$ref": "#/$defs/Handle"
              }
            }
          }
        ]
      },
      "RatioToken": {
        "type": "string",
        "enum": [
          "16:9",
          "9:16",
          "1:1"
        ],
        "description": "Q35/Q56: 16:9 default, 9:16 on request, 1:1 optional per blueprint. No stretched conversion."
      },
      "Energy": {
        "type": "string",
        "enum": [
          "sakin",
          "dengeli",
          "canli"
        ],
        "description": "Q34 Spark inspector control (Enerji): Sakin/Dengeli/Canli (calm/balanced/lively). Free recompile + undo."
      },
      "ColorRoleToken": {
        "type": "string",
        "enum": [
          "canvas",
          "surface",
          "ink",
          "muted",
          "accent",
          "accent-2",
          "gradient"
        ],
        "description": "VideoStyle SS7 color roles."
      },
      "ComponentClass": {
        "type": "string",
        "enum": [
          "content",
          "chrome"
        ],
        "description": "Q58 video chrome ban: a blueprint component is manifest-classified content|chrome. A chrome component is only a candidate in the slide/lecture VideoBrief kinds (TK-20)."
      },
      "Origin": {
        "type": "string",
        "enum": [
          "user",
          "agent",
          "system"
        ],
        "description": "TK-32: an undo record's origin. Placeholder records never enter the undo stack or the sequence revision."
      },
      "EditReceiptStatus": {
        "type": "string",
        "enum": [
          "refused",
          "applied",
          "saved",
          "verified",
          "failed"
        ],
        "description": "MOTOR SS4 receipt stages. P00-13 owns this vocabulary; the composition_command_v1 envelope itself is P00-04's."
      },
      "WriteLevel": {
        "type": "string",
        "enum": [
          "L0",
          "L1",
          "L2"
        ],
        "description": "Q40 authoring levels: L0 library, L1 mixed (per-scene/component code fork), L2 fully LLM code."
      },
      "StockKind": {
        "type": "string",
        "enum": [
          "image",
          "video",
          "music",
          "sfx",
          "vector"
        ],
        "description": "TK-20 canonical Stock catalog kinds. `vector` (icon/illustration/map) added in the anlatim/sketch decision SS1."
      },
      "VideoBriefKind": {
        "type": "string",
        "enum": [
          "product_intro",
          "launch",
          "feature",
          "ad_story",
          "brand_sting",
          "product_film",
          "presentation",
          "lecture_slides"
        ],
        "description": "TK-20 canonical VideoBrief.kind values actually named in the frozen decisions. VideoBrief itself is P04's document; only the kind enum is frozen here. product_film is the Premium Motion hybrid kind (Q54); presentation/lecture_slides are the only kinds where slide_chrome may apply (Q58)."
      },
      "TemplateType": {
        "type": "string",
        "enum": [
          "tanitim_motion_film",
          "slayt_egitim",
          "konsept_video",
          "program_formati",
          "ham_video_formati",
          "sosyal_kanvas_dikey",
          "yorum_tepki_derleme"
        ],
        "description": "TK-20 canonical yapim sablonu (production template) family, anlatim/yerlesim karari SS9 table."
      },
      "SemverRevisionRef": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_-]*@[0-9]+$",
        "description": "`id@revision` reference used throughout the package for blueprint/content-package/style-preset revisions."
      }
    }
  },
  "motion-spark/v1/edit-context.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/edit-context.schema.json",
    "title": "EditContext (P00-13 owned)",
    "description": "MOTOR SS4: Spark attaches this to every Chat message. Selection is intent, never a write authority by itself -- it resolves to explicit handles at parse time against base_revision (K242 rule); an intervening reorder/delete yields a conflict rather than a silent wrong-target edit.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "project_id",
      "base_revision",
      "playhead_frame"
    ],
    "properties": {
      "project_id": {
        "$ref": "common.schema.json#/$defs/CompositionProjectId"
      },
      "base_revision": {
        "type": "integer",
        "minimum": 0
      },
      "playhead_frame": {
        "$ref": "common.schema.json#/$defs/FrameIndex"
      },
      "selection": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "scene_id": {
            "type": "string",
            "minLength": 1
          },
          "layer_ids": {
            "description": "Additive optional field (Y1-07 W8, v1 stays v1): ids of the composition layers the user selected on the canvas inside scene_id (empty or absent = the scene as a whole). Same intent-only rule as scene_id and handles: Composition resolves every id against base_revision, an id that no longer exists is a conflict, never a silent wrong target. handles[] stays for Motion instances.",
            "type": "array",
            "maxItems": 16,
            "uniqueItems": true,
            "items": {
              "type": "string",
              "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
            }
          },
          "handles": {
            "type": "array",
            "items": {
              "$ref": "common.schema.json#/$defs/Handle"
            },
            "uniqueItems": true
          },
          "slot_ids": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "uniqueItems": true
          }
        }
      },
      "region": {
        "description": "An unlabeled marked area (frame + normalized box or free mark), used for hit_test candidate resolution when there is no explicit selection.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "frame",
              "box"
            ],
            "properties": {
              "frame": {
                "$ref": "common.schema.json#/$defs/FrameIndex"
              },
              "box": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "x",
                  "y",
                  "w",
                  "h"
                ],
                "properties": {
                  "x": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "y": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "w": {
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 1
                  },
                  "h": {
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 1
                  }
                }
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "frame",
              "free_mark"
            ],
            "properties": {
              "frame": {
                "$ref": "common.schema.json#/$defs/FrameIndex"
              },
              "free_mark": {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "x",
                    "y"
                  ],
                  "properties": {
                    "x": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1
                    },
                    "y": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1
                    }
                  }
                },
                "minItems": 1
              }
            }
          }
        ]
      },
      "time_range": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "start_frame",
          "end_frame"
        ],
        "properties": {
          "start_frame": {
            "$ref": "common.schema.json#/$defs/FrameIndex"
          },
          "end_frame": {
            "$ref": "common.schema.json#/$defs/FrameIndex"
          }
        }
      },
      "locale": {
        "type": "string",
        "minLength": 2,
        "maxLength": 35
      }
    }
  },
  "scope-grants/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/common.schema.json",
    "title": "scope_grants_common_v1",
    "description": "Shared definitions for the P00-07 scope-grants package. Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "CompositionProjectId": {
        "description": "Composition project id (Spark project entry, PR #294): aligned with api-gateway's newCompositionProjectId, never a generic OpaqueId.",
        "type": "string",
        "pattern": "^cprj_[0-9a-f-]{36}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Sha256": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "Version": {
        "description": "Monotonic owner version used for CAS.",
        "type": "integer",
        "minimum": 0
      },
      "Generation": {
        "description": "Monotonic scope/grant generation. Every mutation that changes who may read bumps it; cache fills are fenced on it.",
        "type": "integer",
        "minimum": 1
      },
      "OwnerBc": {
        "enum": [
          "assistant",
          "memory",
          "composition",
          "brand",
          "storage",
          "connector",
          "avatar",
          "voice"
        ]
      },
      "ResourceType": {
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
          "voice_profile",
          "connected_account",
          "operation_receipt",
          "job",
          "run",
          "pending_invocation",
          "review_request",
          "tool_result",
          "checkpoint"
        ]
      },
      "InheritedResourceType": {
        "description": "These resource types carry no resource_scope_v1 of their own (P00-03/P00-11 own their record shape); they inherit the visibility and scope_generation of the conversation (or other content record) they belong to. See scope-rules.json inherited_scope.",
        "enum": [
          "job",
          "run",
          "pending_invocation",
          "review_request",
          "tool_result",
          "checkpoint"
        ]
      },
      "ResourceRef": {
        "description": "Typed owner reference; the owner BC resolves it. A label or URL is never an identity.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "resource_type",
          "resource_id"
        ],
        "properties": {
          "owner_bc": {
            "$ref": "#/$defs/OwnerBc"
          },
          "resource_type": {
            "$ref": "#/$defs/ResourceType"
          },
          "resource_id": {
            "$ref": "#/$defs/OpaqueId"
          }
        }
      },
      "Visibility": {
        "description": "private: owner only. shared: owner plus the explicit grants recorded for the resource. No other value exists (Q102: legacy scopes are out of scope).",
        "enum": [
          "private",
          "shared"
        ]
      },
      "Audience": {
        "description": "Explicit grant audience. A tenant role is never an audience. project_members always names a Composition project (cprj_ id, PR #294), never a generic OpaqueId.",
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
              "channel_members",
              "project_members"
            ]
          },
          "id": {
            "$ref": "#/$defs/OpaqueId"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "project_members"
                }
              },
              "required": [
                "kind"
              ]
            },
            "then": {
              "properties": {
                "id": {
                  "$ref": "#/$defs/CompositionProjectId"
                }
              }
            }
          }
        ]
      },
      "Permission": {
        "description": "read: list/detail/search/SSE/replay/Review/artifact/cache. use_in_context: summary and context assembly. edit: owner-defined mutation.",
        "enum": [
          "read",
          "use_in_context",
          "edit"
        ]
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["assistant-message-context", "canonical-context", "inference-execution-spec", "invocation-cause", "job-cancel-command", "job-projection", "job-version-vector", "owner-refs", "pending-invocation", "provider-protocol-appendix", "reply-binding", "tool-result"] as const;
export type DocumentType = "assistant-message-context" | "canonical-context" | "inference-execution-spec" | "invocation-cause" | "job-cancel-command" | "job-projection" | "job-version-vector" | "owner-refs" | "pending-invocation" | "provider-protocol-appendix" | "reply-binding" | "tool-result";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "assistant-message-context": [
    "assistant_message_context_v1"
  ],
  "canonical-context": [
    "canonical_context_v1"
  ],
  "inference-execution-spec": [
    "inference_execution_spec_v1"
  ],
  "invocation-cause": [
    "invocation_cause_v1"
  ],
  "job-cancel-command": [
    "job_cancel_command_v1"
  ],
  "job-projection": [
    "job_projection_v1"
  ],
  "pending-invocation": [
    "pending_invocation_v1"
  ],
  "provider-protocol-appendix": [
    "provider_protocol_appendix_v1"
  ],
  "reply-binding": [
    "reply_binding_v1"
  ],
  "tool-result": [
    "tool_result_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "job-projection": {
    "job_status": [
      "admitted",
      "awaiting_g1",
      "awaiting_g2",
      "canceled",
      "completed",
      "draft",
      "expired",
      "failed",
      "funding_required",
      "partial",
      "plan_ready",
      "preparing",
      "preview_ready",
      "producing",
      "queued",
      "rejected",
      "rendering",
      "waiting_input"
    ]
  },
  "tool-result": {
    "abandon_reason": [
      "context_limit_summarize",
      "lane_b_cancel",
      "supplier_switch",
      "user_cancel"
    ],
    "reason_code": [
      "connection_disabled",
      "feature_unavailable",
      "forbidden",
      "needs_connection",
      "policy_denied",
      "rate_limited",
      "reauth_required",
      "resource_selection_required",
      "scope_required",
      "source_version_changed",
      "tool_revision_changed",
      "unsupported_protocol",
      "validation_failed"
    ],
    "settlement_basis": [
      "provider_reported_usage",
      "reserved_estimate"
    ]
  }
};

export type AssistantMessageContext = {
    readonly "schema_version": "assistant_message_context_v1";
    readonly "surface": "dashboard_chat" | "spark_chat" | "workflow_authoring" | "motion_authoring";
    readonly "surface_context"?: (unknown);
    readonly "channel_id"?: string;
    readonly "locale"?: string;
    readonly "attachments"?: readonly (unknown)[];
    readonly "mentions"?: readonly (unknown)[];
    readonly "selected_skill_refs"?: readonly (unknown)[];
    readonly "preferred_tools"?: readonly (unknown)[];
    readonly "composer_selection"?: unknown;
    readonly "job_target"?: unknown;
    readonly "reply_to"?: unknown;
    readonly "pinned_constraints"?: readonly (string)[];
  };
export type CanonicalContext = {
    readonly "schema_version": "canonical_context_v1";
    readonly "canonical_context_id": string;
    readonly "conversation_id": string;
    readonly "job_id": string;
    readonly "context_epoch": number;
    readonly "record_visibility": "private" | "shared";
    readonly "checkpoint"?: unknown;
    readonly "through_event_sequence": number;
    readonly "entries": readonly (unknown)[];
    readonly "system_guide_refs": readonly (unknown)[];
    readonly "selected_skill_refs": readonly (unknown)[];
    readonly "open_pending_invocation_ids": readonly (string)[];
    readonly "context_hash": string;
  };
export type InferenceExecutionSpec = {
    readonly "schema_version": "inference_execution_spec_v1";
    readonly "execution_spec_id": string;
    readonly "immutable": true;
    readonly "job_id": string;
    readonly "run_id": string;
    readonly "logical_operation_id": string;
    readonly "attempt_id": string;
    readonly "idempotency_key": string;
    readonly "invocation_cause_id": string;
    readonly "model_ref": unknown;
    readonly "api_family": "openai_responses" | "openai_chat_completions_compatible" | "gemini_interactions" | "gemini_generate_content" | "anthropic_messages";
    readonly "endpoint_revision": string;
    readonly "serializer_revision": string;
    readonly "account_scope_ref": string;
    readonly "region"?: string;
    readonly "job_settings_version": number;
    readonly "model_epoch": number;
    readonly "canonical_context_id": string;
    readonly "context_epoch": number;
    readonly "context_hash": string;
    readonly "through_event_sequence": number;
    readonly "provider_appendix_id": (string) | (null);
    readonly "tool_schema_sha256": string;
    readonly "pricing_revision": string;
    readonly "envelope_id": string;
    readonly "allocation_id": string;
    readonly "created_at": string;
  };
export type InvocationCause = {
    readonly "schema_version": "invocation_cause_v1";
    readonly "invocation_cause_id": string;
    readonly "derived_by": "server";
    readonly "cause_kind": "chat_message" | "chat_reply" | "review_decision" | "workflow_node" | "schedule" | "api_request" | "mcp_request" | "connector_webhook" | "system_recovery";
    readonly "channel": "app" | "api" | "mcp";
    readonly "tenant_id": string;
    readonly "principal": unknown;
    readonly "surface"?: "dashboard_chat" | "spark_chat" | "workflow_authoring" | "motion_authoring";
    readonly "conversation_id"?: string;
    readonly "message_id"?: string;
    readonly "reply_binding_id"?: string;
    readonly "job_id"?: string;
    readonly "review_request_id"?: string;
    readonly "decision_version"?: number;
    readonly "workflow_run_id"?: string;
    readonly "node_uid"?: string;
    readonly "schedule_id"?: string;
    readonly "trigger_id"?: string;
    readonly "request_idempotency_key"?: string;
    readonly "recovered_operation_id"?: string;
    readonly "derived_at": string;
  };
export type JobCancelCommand = {
    readonly "schema_version": "job_cancel_command_v1";
    readonly "command_id": string;
    readonly "idempotency_key": string;
    readonly "conversation_id": string;
    readonly "job_id": string;
    readonly "expected_job_version": number;
    readonly "actor": unknown;
    readonly "issued_at": string;
  };
export type JobProjection = {
    readonly "schema_version": "job_projection_v1";
    readonly "job_id": string;
    readonly "conversation_id": string;
    readonly "job_status": "draft" | "preparing" | "waiting_input" | "plan_ready" | "awaiting_g1" | "funding_required" | "admitted" | "queued" | "producing" | "partial" | "preview_ready" | "awaiting_g2" | "rendering" | "completed" | "failed" | "canceled" | "rejected" | "expired";
    readonly "resume_status"?: "plan_ready" | "preparing" | "awaiting_g1" | "admitted" | "queued" | "producing" | "preview_ready" | "awaiting_g2" | "rendering";
    readonly "funding_reason"?: "balance_insufficient" | "grant_insufficient";
    readonly "cancel_reason"?: "user_cancel" | "schedule_skipped_insufficient_balance";
    readonly "stage"?: (string) | (null);
    readonly "attention": readonly ("sync_required" | "fallback_used" | "needs_connection" | "unsupported_script" | "admin_review")[];
    readonly "mode": "ask" | "auto" | "auto_full";
    readonly "production_plan_revision": (number) | (null);
    readonly "versions": unknown;
    readonly "envelope_id": (string) | (null);
    readonly "expires_at"?: string;
    readonly "render_retry_count"?: number;
    readonly "runtime_terminal": unknown;
    readonly "finance_settlement": unknown;
    readonly "artifact_delivery": unknown;
    readonly "event_cursor": number;
    readonly "updated_at": string;
  };
export type JobVersionVector = {
    readonly "job_version": number;
    readonly "job_settings_version": number;
    readonly "conversation_defaults_version": number;
    readonly "model_epoch": number;
    readonly "grant_version": number;
    readonly "approval_version": (number) | (null);
    readonly "decision_version": (number) | (null);
    readonly "delivery_version": (number) | (null);
  };
export type OwnerRefs = (unknown);
export type PendingInvocation = {
    readonly "schema_version": "pending_invocation_v1";
    readonly "pending_invocation_id": string;
    readonly "version": number;
    readonly "conversation_id": string;
    readonly "job_id": string;
    readonly "run_id": string;
    readonly "step_id": string;
    readonly "awaiting_user_id": string;
    readonly "kind": "input_request" | "approval_request" | "connection_request";
    readonly "state": "open" | "answered" | "superseded" | "expired" | "canceled";
    readonly "prompt_message_id": string;
    readonly "required_field_keys"?: readonly (string)[];
    readonly "review_request_id"?: string;
    readonly "approval_kind"?: "g1" | "g2" | "external_action";
    readonly "connection_requirement_id"?: string;
    readonly "answered_by_reply_binding_id"?: string;
    readonly "expires_at": string;
    readonly "created_at": string;
  };
export type ProviderProtocolAppendix = {
    readonly "schema_version": "provider_protocol_appendix_v1";
    readonly "appendix_id": string;
    readonly "canonical_context_id": string;
    readonly "context_epoch": number;
    readonly "lineage_id": string;
    readonly "api_family": "openai_responses" | "openai_chat_completions_compatible" | "gemini_interactions" | "gemini_generate_content" | "anthropic_messages";
    readonly "model_ref": unknown;
    readonly "serializer_revision": string;
    readonly "account_scope_ref": string;
    readonly "region"?: string;
    readonly "covered_through_event_sequence": number;
    readonly "native_state_kind": "response_id" | "encrypted_reasoning_item" | "thought_signature" | "cached_content_handle" | "native_compaction_block" | "native_tool_call_ids";
    readonly "opaque_payload_ref": string;
    readonly "opaque_payload_sha256": string;
    readonly "reuse_policy": "same_api_family_and_lineage_with_verified_suffix";
    readonly "expires_at"?: string;
    readonly "created_at": string;
  };
export type ReplyBinding = {
    readonly "schema_version": "reply_binding_v1";
    readonly "reply_binding_id": string;
    readonly "derived_by": "server";
    readonly "conversation_id": string;
    readonly "message_id": string;
    readonly "replying_user_id": string;
    readonly "awaiting_user_id"?: string;
    readonly "binding_source": "explicit_reply" | "single_open_pending" | "mention";
    readonly "resolution": "bound" | "stale_version" | "target_not_open" | "not_awaited_user" | "ambiguous_target";
    readonly "job_id"?: string;
    readonly "pending_invocation_id"?: string;
    readonly "expected_pending_version"?: number;
    readonly "observed_pending_version"?: number;
    readonly "candidate_job_ids"?: readonly (string)[];
    readonly "resolved_at": string;
  };
export type ToolResult = (unknown);

export const reader = new ContractPackageReader({
  package: "assistant-runtime",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
