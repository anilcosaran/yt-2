// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/production-launch/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/production-launch/v1/common.schema.json",
    "title": "production_launch_common_v1",
    "description": "Shared definitions of the production-launch v1 package (P03-21 launch/reply-binding core). Not a standalone document type. Ids, hashes, revisions and job statuses are owned by assistant-runtime v1; plan refs by video-preparation v1.",
    "$defs": {
      "PresentationId": {
        "type": "string",
        "pattern": "^ppres_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
      },
      "IntentId": {
        "type": "string",
        "pattern": "^plint_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
      },
      "PlanRef": {
        "description": "Exact production plan revision (video-preparation v1 ArtifactRevisionRef, kind production_plan).",
        "allOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "production_plan"
              }
            }
          }
        ]
      },
      "ApprovalTarget": {
        "description": "The job's open approval wait the G1 decision continues: the compiled draft the plan's execution names. The existing run continuation launches exactly this target once (K335).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "id",
          "hash"
        ],
        "properties": {
          "type": {
            "const": "draft"
          },
          "id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "hash": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "Decision": {
        "enum": [
          "approve",
          "reject",
          "request_changes"
        ]
      },
      "DecisionSource": {
        "description": "Q17/F17: the card button, a written chat approval (F17a binding) and the Review Inbox are equivalent paths to the same canonical G1 command.",
        "enum": [
          "card",
          "chat_reply",
          "inbox"
        ]
      },
      "Credits": {
        "type": "number",
        "minimum": 0,
        "multipleOf": 0.0001
      },
      "StageId": {
        "description": "Stable step ids of the video production progress (KARAR-VIDEO-BRIEF \u00a79).",
        "enum": [
          "brief",
          "research",
          "script",
          "plan",
          "approval",
          "audio_media",
          "apply_qc",
          "preview",
          "render"
        ]
      },
      "StageStatus": {
        "description": "Stage status is separate from job_status. waiting = needs a person (input/decision); blocked = needs a fix (QA/funding/stale plan).",
        "enum": [
          "pending",
          "running",
          "waiting",
          "blocked",
          "completed",
          "skipped",
          "failed"
        ]
      },
      "AttentionKind": {
        "description": "QA, funding, queue and Review stay separate (K205).",
        "enum": [
          "qa",
          "funding",
          "queue",
          "review"
        ]
      }
    }
  },
  "production-g1-command.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/production-launch/v1/production-g1-command.schema.json",
    "title": "production_g1_command_v1",
    "description": "The canonical G1 command every path normalizes to (card `Bu planla \u00fcret`, written chat approval, Review Inbox; Q17/F17). It names the exact presented plan revision, fingerprint and approved ceiling the actor saw; the server re-checks current plan/quote/presentation/approval wait before recording anything (8E, K229). The actor is server-derived. A chat reply carries its F17a binding (classifier revision + confidence); an Inbox decision its Review request. The HTTP answer is 'accepted', never 'production started'.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "presentation_id",
      "expected_presentation_version",
      "plan_ref",
      "g1_fingerprint_sha256",
      "approved_max_credits",
      "decision",
      "source",
      "actor_user_id",
      "idempotency_key"
    ],
    "properties": {
      "schema_version": {
        "const": "production_g1_command_v1"
      },
      "presentation_id": {
        "$ref": "common.schema.json#/$defs/PresentationId"
      },
      "expected_presentation_version": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
      },
      "plan_ref": {
        "$ref": "common.schema.json#/$defs/PlanRef"
      },
      "g1_fingerprint_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "approved_max_credits": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          {
            "type": "null"
          }
        ]
      },
      "decision": {
        "$ref": "common.schema.json#/$defs/Decision"
      },
      "source": {
        "$ref": "common.schema.json#/$defs/DecisionSource"
      },
      "actor_user_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "idempotency_key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "comment": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "binding": {
        "description": "F17a: set for source=chat_reply only.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "message_id",
          "binding_source",
          "classifier_revision",
          "confidence"
        ],
        "properties": {
          "message_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "binding_source": {
            "enum": [
              "explicit_reply",
              "single_open_pending",
              "mention"
            ]
          },
          "classifier_revision": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          }
        }
      },
      "review_request_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "source": {
              "const": "chat_reply"
            }
          }
        },
        "then": {
          "required": [
            "binding"
          ],
          "properties": {
            "decision": {
              "const": "approve"
            }
          }
        },
        "else": {
          "not": {
            "required": [
              "binding"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "source": {
              "const": "inbox"
            }
          }
        },
        "then": {
          "required": [
            "review_request_id"
          ]
        },
        "else": {
          "not": {
            "required": [
              "review_request_id"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "decision": {
              "const": "request_changes"
            }
          }
        },
        "then": {
          "required": [
            "comment"
          ]
        }
      }
    ]
  },
  "production-launch-intent.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/production-launch/v1/production-launch-intent.schema.json",
    "title": "production_launch_intent_v1",
    "description": "Durable launch intent of one approved presentation (exactly one per presentation, so double clicks, Chat + Inbox approvals and lost HTTP answers converge on it; K199/K227). It is the outbox of the G1 decision: a relay hands it to the job's run continuation with a deterministic idempotency key; admission (P00-10) and the single launch run in the existing run worker path, and their progress is read from the owner, never stored here. handed_off is not 'production started'.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "intent_id",
      "presentation_id",
      "job_id",
      "conversation_id",
      "plan_ref",
      "g1_fingerprint_sha256",
      "approved_max_credits",
      "approval_target",
      "status",
      "continuation_idempotency_key",
      "attempts",
      "version",
      "created_at",
      "updated_at"
    ],
    "properties": {
      "schema_version": {
        "const": "production_launch_intent_v1"
      },
      "intent_id": {
        "$ref": "common.schema.json#/$defs/IntentId"
      },
      "presentation_id": {
        "$ref": "common.schema.json#/$defs/PresentationId"
      },
      "job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "conversation_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "plan_ref": {
        "$ref": "common.schema.json#/$defs/PlanRef"
      },
      "g1_fingerprint_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "approved_max_credits": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          {
            "type": "null"
          }
        ]
      },
      "approval_target": {
        "$ref": "common.schema.json#/$defs/ApprovalTarget"
      },
      "status": {
        "description": "recorded: decision committed, not yet handed to the run. handed_off: the run continuation (admission + one launch) is durably enqueued. refused: the run no longer waits on that exact target (plan moved, wait closed/expired). canceled: the job was canceled before the hand-off.",
        "enum": [
          "recorded",
          "handed_off",
          "refused",
          "canceled"
        ]
      },
      "refusal_reason": {
        "enum": [
          "target_moved",
          "run_not_waiting",
          "run_not_found",
          "plan_changed"
        ]
      },
      "continuation_idempotency_key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "attempts": {
        "type": "integer",
        "minimum": 0
      },
      "next_attempt_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "handed_off_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "version": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
      },
      "created_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "updated_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "status": {
              "const": "refused"
            }
          }
        },
        "then": {
          "required": [
            "refusal_reason"
          ]
        },
        "else": {
          "not": {
            "required": [
              "refusal_reason"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "handed_off"
            }
          }
        },
        "then": {
          "required": [
            "handed_off_at"
          ]
        }
      }
    ]
  },
  "production-plan-presentation.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/production-launch/v1/production-plan-presentation.schema.json",
    "title": "production_plan_presentation_v1",
    "description": "Server `presented` record of one exact ready plan revision for the job's G1 (F17: only a presented plan/quote/ceiling can be approved; F17a: a written approval binds only to a presented record). Also the payload of the public `assistant.production_plan.presented` event the G1 card renders. A newer presentation of the same job supersedes the open one; a decided presentation keeps its decision.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "presentation_id",
      "job_id",
      "conversation_id",
      "project_id",
      "awaiting_user_id",
      "plan_ref",
      "g1_fingerprint_sha256",
      "approved_max_credits",
      "approval_target",
      "state",
      "version",
      "presented_at",
      "expires_at"
    ],
    "properties": {
      "schema_version": {
        "const": "production_plan_presentation_v1"
      },
      "presentation_id": {
        "$ref": "common.schema.json#/$defs/PresentationId"
      },
      "job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "conversation_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "awaiting_user_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "plan_ref": {
        "$ref": "common.schema.json#/$defs/PlanRef"
      },
      "g1_fingerprint_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "estimate": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "estimate_revision",
          "min_credits",
          "max_credits"
        ],
        "properties": {
          "estimate_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          "min_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          "max_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          "point_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          }
        }
      },
      "approved_max_credits": {
        "description": "The ceiling the card shows and the decision approves (F17 `approved_max_credits`); null = no priced ceiling (never shown as 0).",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          {
            "type": "null"
          }
        ]
      },
      "approval_target": {
        "$ref": "common.schema.json#/$defs/ApprovalTarget"
      },
      "state": {
        "enum": [
          "presented",
          "approved",
          "rejected",
          "changes_requested",
          "superseded",
          "expired",
          "canceled"
        ]
      },
      "version": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
      },
      "presented_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "expires_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "decided": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "decision",
          "source",
          "decided_by",
          "decided_at"
        ],
        "properties": {
          "decision": {
            "$ref": "common.schema.json#/$defs/Decision"
          },
          "source": {
            "$ref": "common.schema.json#/$defs/DecisionSource"
          },
          "decided_by": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "decided_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "intent_id": {
            "$ref": "common.schema.json#/$defs/IntentId"
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "state": {
              "enum": [
                "approved",
                "rejected",
                "changes_requested"
              ]
            }
          }
        },
        "then": {
          "required": [
            "decided"
          ]
        },
        "else": {
          "not": {
            "required": [
              "decided"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "state": {
              "const": "approved"
            }
          }
        },
        "then": {
          "properties": {
            "decided": {
              "required": [
                "intent_id"
              ],
              "properties": {
                "decision": {
                  "const": "approve"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "state": {
              "const": "rejected"
            }
          }
        },
        "then": {
          "properties": {
            "decided": {
              "properties": {
                "decision": {
                  "const": "reject"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "state": {
              "const": "changes_requested"
            }
          }
        },
        "then": {
          "properties": {
            "decided": {
              "properties": {
                "decision": {
                  "const": "request_changes"
                }
              }
            }
          }
        }
      }
    ]
  },
  "video-production-progress.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/production-launch/v1/video-production-progress.schema.json",
    "title": "video_production_progress_v1",
    "description": "Owner-sourced stage/status projection of one video job (KARAR-VIDEO-BRIEF \u00a79; K202/K205): brief, research, script, plan, approval, audio_media, apply_qc, preview, render with stable step ids, exact artifact/chapter/shot refs and only real counters (no fake percentage, no ETA). job_status is the P00-03 status; stage status is separate; QA/funding/queue/Review attention is separate. It is rebuilt from durable owner records on every read (server checkpoint for reconnect) and published as the `assistant.production_progress.updated` run event, so the P01-15 durable cursor replays it; run_event_sequence names the run-local event the projection includes.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "job_id",
      "conversation_id",
      "project_id",
      "job_status",
      "production_plan_revision",
      "plan_ref",
      "stages",
      "attention",
      "launch",
      "run_event_sequence",
      "generated_at"
    ],
    "properties": {
      "schema_version": {
        "const": "video_production_progress_v1"
      },
      "job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "conversation_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "project_id": {
        "oneOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
          },
          {
            "type": "null"
          }
        ]
      },
      "job_status": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/JobStatus"
      },
      "production_plan_revision": {
        "description": "The job's plan revision (not Feature Control subscription_plan_revision).",
        "oneOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          {
            "type": "null"
          }
        ]
      },
      "plan_ref": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/PlanRef"
          },
          {
            "type": "null"
          }
        ]
      },
      "stages": {
        "type": "array",
        "minItems": 9,
        "maxItems": 9,
        "items": {
          "$ref": "#/$defs/Stage"
        }
      },
      "attention": {
        "type": "array",
        "maxItems": 8,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "code"
          ],
          "properties": {
            "kind": {
              "$ref": "common.schema.json#/$defs/AttentionKind"
            },
            "code": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{0,63}$"
            },
            "step_id": {
              "$ref": "common.schema.json#/$defs/StageId"
            }
          }
        }
      },
      "launch": {
        "description": "G1 \u2192 launch chain as the owners report it. accepted/handed_off are acknowledgements, never 'started'; started is true only when the Workflow owner reports execution.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "state",
          "started"
        ],
        "properties": {
          "state": {
            "enum": [
              "none",
              "awaiting_decision",
              "accepted",
              "handed_off",
              "launching",
              "queued",
              "producing",
              "funding_required",
              "refused",
              "rejected",
              "changes_requested"
            ]
          },
          "started": {
            "type": "boolean"
          },
          "presentation_id": {
            "$ref": "common.schema.json#/$defs/PresentationId"
          },
          "intent_id": {
            "$ref": "common.schema.json#/$defs/IntentId"
          },
          "handoff_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "refusal_reason": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "started": {
                  "const": true
                }
              }
            },
            "then": {
              "properties": {
                "state": {
                  "const": "producing"
                }
              }
            }
          }
        ]
      },
      "run_event_sequence": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/EventSequence"
      },
      "generated_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    },
    "$defs": {
      "Stage": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "step_id",
          "status",
          "refs"
        ],
        "properties": {
          "step_id": {
            "$ref": "common.schema.json#/$defs/StageId"
          },
          "status": {
            "$ref": "common.schema.json#/$defs/StageStatus"
          },
          "refs": {
            "type": "array",
            "maxItems": 10,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "id"
              ],
              "properties": {
                "kind": {
                  "enum": [
                    "video_brief",
                    "research_pack",
                    "script",
                    "shot_plan",
                    "production_plan",
                    "presentation",
                    "launch_intent",
                    "workflow_handoff"
                  ]
                },
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 128
                },
                "revision": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
                }
              }
            }
          },
          "counters": {
            "description": "Only real counts ('8 b\u00f6l\u00fcmden 5'i yaz\u0131ld\u0131', '12 shot'). Absent when the owner has no measured count.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "completed",
              "total",
              "unit"
            ],
            "properties": {
              "completed": {
                "type": "integer",
                "minimum": 0
              },
              "total": {
                "type": "integer",
                "minimum": 0
              },
              "unit": {
                "enum": [
                  "chapters",
                  "shots",
                  "outputs",
                  "items"
                ]
              }
            }
          },
          "detail_code": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          }
        }
      }
    }
  }
} as const;

// Foreign schema files reached through cross-package $refs, embedded verbatim
// from their owner package and registered next to SCHEMAS.
export const DEPENDENCY_SCHEMAS = {
  "assistant-runtime/v1/common.schema.json": {
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
  "video-preparation/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json",
    "title": "video_preparation_common_v1",
    "description": "Shared definitions of the video-preparation v1 package (P04-15 schema part). Not a standalone document type. Ids, hashes, revisions and project ids are owned by assistant-runtime v1 and referenced, never copied.",
    "$defs": {
      "ArtifactKind": {
        "description": "Typed preparation artifact kinds (KARAR-VIDEO-BRIEF-SCRIPT-PLAN-VE-ONAY \u00a74). research_pack is P04-15's addition next to the P00-04 PreparationArtifactRef kinds.",
        "enum": [
          "video_brief",
          "research_pack",
          "script",
          "shot_plan",
          "production_plan"
        ]
      },
      "ArtifactId": {
        "description": "Composition-owned preparation artifact id.",
        "type": "string",
        "pattern": "^vprep_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
      },
      "ArtifactRevisionRef": {
        "description": "Exact immutable revision of one preparation artifact. The digest is the canonical sha256 of the stored body; a ref whose digest does not match the owner's revision is stale.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "artifact_kind",
          "artifact_id",
          "artifact_revision",
          "content_digest_sha256"
        ],
        "properties": {
          "artifact_kind": {
            "$ref": "#/$defs/ArtifactKind"
          },
          "artifact_id": {
            "$ref": "#/$defs/ArtifactId"
          },
          "artifact_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          "content_digest_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "StableId": {
        "description": "Stable chapter/beat/shot/source/claim id; unique inside its artifact, kept across revisions (execution, timeline narration bindings and progress refs use it).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_-]{0,63}$"
      },
      "Seconds": {
        "description": "Duration in seconds (planned/estimated before TTS, measured after).",
        "type": "number",
        "minimum": 0,
        "maximum": 36000
      },
      "Locale": {
        "type": "string",
        "pattern": "^[a-z]{2,3}(-[A-Z]{2})?$"
      },
      "AspectRatio": {
        "description": "Same set as the Composition project aspect ratio (#294).",
        "enum": [
          "16:9",
          "9:16",
          "1:1"
        ]
      },
      "Credits": {
        "description": "Credit amount (P00-10 precision 0.0001).",
        "type": "number",
        "minimum": 0,
        "multipleOf": 0.0001
      },
      "SectionRole": {
        "description": "Template structure role (KARAR 8C): intro/hook, main chapters, outro/CTA.",
        "enum": [
          "intro",
          "main",
          "outro",
          "cta"
        ]
      },
      "OwnerResourceRef": {
        "description": "Typed owner resource ref used by bindings (avatar/voice/template/element/kit/asset). No universal revision_id: the owner names its own revision.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "resource_kind",
          "resource_id"
        ],
        "properties": {
          "owner_bc": {
            "enum": [
              "avatar",
              "voice",
              "brand",
              "storage",
              "composition",
              "media_catalog"
            ]
          },
          "resource_kind": {
            "description": "P04-19 (additive v1 note R12-4) adds `motion`: a Brand Motion library revision the director resolver pinned.",
            "enum": [
              "avatar",
              "voice",
              "template",
              "intro",
              "outro",
              "element",
              "kit",
              "asset",
              "stock_item",
              "motion"
            ]
          },
          "resource_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "resource_revision": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          }
        }
      },
      "CapabilityRef": {
        "description": "Real Workflow catalog node the shot or operation needs. A name that is not in the tenant's catalog fails the capability validator; nothing is inferred from a product name (K230).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "node_type",
          "capability"
        ],
        "properties": {
          "node_type": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(@[0-9]+)?$",
            "maxLength": 128
          },
          "capability": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CapabilityKey"
          },
          "model_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/ModelId"
          }
        }
      },
      "SelectionSource": {
        "description": "Why a binding/value was chosen (KARAR \u00a72 step 1, 8B order).",
        "enum": [
          "explicit",
          "job_selection",
          "template",
          "channel_default",
          "personal_default",
          "product_default",
          "product_suggestion"
        ]
      },
      "Provenance": {
        "description": "How a revision came to be. attached_from is the F23 copy-on-attach source (exact immutable revision; never rewritten by a writer call).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "origin"
        ],
        "properties": {
          "origin": {
            "enum": [
              "agent",
              "user",
              "system",
              "import",
              "attach"
            ]
          },
          "job_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.:-]{0,127}$"
          },
          "node_result": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "node_type",
              "result_digest_sha256"
            ],
            "properties": {
              "node_type": {
                "type": "string",
                "maxLength": 128
              },
              "result_digest_sha256": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              }
            }
          },
          "attached_from": {
            "$ref": "#/$defs/AttachSourceRef"
          },
          "change_summary": {
            "type": "string",
            "maxLength": 500
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "origin": {
                  "const": "attach"
                }
              }
            },
            "then": {
              "required": [
                "attached_from"
              ]
            },
            "else": {
              "not": {
                "required": [
                  "attached_from"
                ]
              }
            }
          }
        ]
      },
      "AttachSourceRef": {
        "description": "Exact source revision of an attached script (F23), or of the research pack the attached script cites (copied with it so its claim refs stay exact). owner_bc assistant = standalone script artifact store; composition = another project's artifact.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "artifact_kind",
          "artifact_id",
          "artifact_revision",
          "content_digest_sha256"
        ],
        "properties": {
          "owner_bc": {
            "enum": [
              "assistant",
              "composition"
            ]
          },
          "artifact_kind": {
            "enum": [
              "script",
              "research_pack"
            ]
          },
          "artifact_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "artifact_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          "content_digest_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "ValidatorName": {
        "description": "Server validators of the ready rule (\u00a74 Ready kural\u0131).",
        "enum": [
          "schema",
          "semantic",
          "coverage",
          "timing",
          "capability",
          "estimate"
        ]
      },
      "ValidationIssue": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "validator",
          "code",
          "severity",
          "path"
        ],
        "properties": {
          "validator": {
            "$ref": "#/$defs/ValidatorName"
          },
          "code": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          },
          "severity": {
            "enum": [
              "error",
              "warning"
            ]
          },
          "path": {
            "type": "string",
            "maxLength": 256
          },
          "ref": {
            "type": "string",
            "maxLength": 128
          }
        }
      },
      "Readiness": {
        "description": "draft: saved, not offered for G1 (e.g. outline, estimate pending). not_ready: validation failed. ready: every validator passed. stale: derived at read time when a dependency head moved past the pinned ref.",
        "enum": [
          "draft",
          "not_ready",
          "ready",
          "stale"
        ]
      },
      "QualityTier": {
        "description": "P04-03 (additive v1 note): the Ekonomik/Dengeli/Kalite profile a generation was planned with (KARAR 8F). A label of the owner choice, never a claim that a model is measured best.",
        "enum": [
          "economy",
          "balanced",
          "quality"
        ]
      },
      "TransitionHandles": {
        "description": "P04-03 (additive v1 note): extra generated seconds before/after the usable window that a transition may use; never counted as timeline time.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "in_seconds",
          "out_seconds"
        ],
        "properties": {
          "in_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 10
          },
          "out_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 10
          }
        }
      },
      "NarratorTiming": {
        "description": "P04-03 (additive v1 note): where the shot's narration is spoken inside the shot, relative to the shot start. `estimated` before TTS (speech-rate basis); `measured` only after the real TTS/alignment (P04-07).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "start_seconds",
          "end_seconds",
          "basis"
        ],
        "properties": {
          "start_seconds": {
            "$ref": "#/$defs/Seconds"
          },
          "end_seconds": {
            "$ref": "#/$defs/Seconds"
          },
          "basis": {
            "enum": [
              "estimated",
              "measured"
            ]
          }
        }
      },
      "OperationId": {
        "description": "P04-15 compiler (additive v1 note): id of one compiled logical operation, sha256-derived from job + operation key + input hash (a changed input is a new operation; a recovery of the same operation keeps its id). Matches the P03-06 production operation id pattern.",
        "type": "string",
        "pattern": "^vop_[a-f0-9]{32}$"
      },
      "GeneratedTakeRef": {
        "description": "P04-03 (additive v1 note) F21 GeneratedTake identity: one result of one GenerationShot attempt. take_id = '<generation_shot_id>-t<attempt>' (preparation-rules.json derivation_rules). Produced by execution (P04-08); a new user take is a new attempt, a recovery of the same operation keeps its attempt.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "take_id",
          "generation_shot_id",
          "attempt"
        ],
        "properties": {
          "take_id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_-]{0,63}-t[0-9]{1,3}$"
          },
          "generation_shot_id": {
            "$ref": "#/$defs/StableId"
          },
          "attempt": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100
          },
          "operation_id": {
            "$ref": "#/$defs/OperationId"
          }
        }
      },
      "ClipInstanceTarget": {
        "description": "P04-03 (additive v1 note) F21 ClipInstance target: the plan scene and its typed layer that a take or a reused asset fills (materialized as a Composition clip layer through the P03-06 production binding).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scene_id",
          "layer_key"
        ],
        "properties": {
          "scene_id": {
            "$ref": "#/$defs/StableId"
          },
          "layer_key": {
            "$ref": "#/$defs/StableId"
          }
        }
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["production-g1-command", "production-launch-intent", "production-plan-presentation", "video-production-progress"] as const;
export type DocumentType = "production-g1-command" | "production-launch-intent" | "production-plan-presentation" | "video-production-progress";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "production-g1-command": [
    "production_g1_command_v1"
  ],
  "production-launch-intent": [
    "production_launch_intent_v1"
  ],
  "production-plan-presentation": [
    "production_plan_presentation_v1"
  ],
  "video-production-progress": [
    "video_production_progress_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "production-launch-intent": {
    "status": [
      "canceled",
      "handed_off",
      "recorded",
      "refused"
    ]
  },
  "video-production-progress": {
    "status": [
      "blocked",
      "completed",
      "failed",
      "pending",
      "running",
      "skipped",
      "waiting"
    ]
  }
};

export type ProductionG1Command = {
    readonly "schema_version": "production_g1_command_v1";
    readonly "presentation_id": string;
    readonly "expected_presentation_version": unknown;
    readonly "plan_ref": unknown;
    readonly "g1_fingerprint_sha256": unknown;
    readonly "approved_max_credits": (number) | (null);
    readonly "decision": "approve" | "reject" | "request_changes";
    readonly "source": "card" | "chat_reply" | "inbox";
    readonly "actor_user_id": unknown;
    readonly "idempotency_key": string;
    readonly "comment"?: string;
    readonly "binding"?: {
    readonly "message_id": unknown;
    readonly "binding_source": "explicit_reply" | "single_open_pending" | "mention";
    readonly "classifier_revision": string;
    readonly "confidence": number;
  };
    readonly "review_request_id"?: unknown;
  };
export type ProductionLaunchIntent = {
    readonly "schema_version": "production_launch_intent_v1";
    readonly "intent_id": string;
    readonly "presentation_id": string;
    readonly "job_id": unknown;
    readonly "conversation_id": unknown;
    readonly "plan_ref": unknown;
    readonly "g1_fingerprint_sha256": unknown;
    readonly "approved_max_credits": (number) | (null);
    readonly "approval_target": unknown;
    readonly "status": "recorded" | "handed_off" | "refused" | "canceled";
    readonly "refusal_reason"?: "target_moved" | "run_not_waiting" | "run_not_found" | "plan_changed";
    readonly "continuation_idempotency_key": string;
    readonly "attempts": number;
    readonly "next_attempt_at"?: unknown;
    readonly "handed_off_at"?: unknown;
    readonly "version": unknown;
    readonly "created_at": unknown;
    readonly "updated_at": unknown;
  };
export type ProductionPlanPresentation = {
    readonly "schema_version": "production_plan_presentation_v1";
    readonly "presentation_id": string;
    readonly "job_id": unknown;
    readonly "conversation_id": unknown;
    readonly "project_id": unknown;
    readonly "awaiting_user_id": unknown;
    readonly "plan_ref": unknown;
    readonly "g1_fingerprint_sha256": unknown;
    readonly "estimate"?: {
    readonly "estimate_revision": unknown;
    readonly "min_credits": number;
    readonly "max_credits": number;
    readonly "point_credits"?: number;
  };
    readonly "approved_max_credits": (number) | (null);
    readonly "approval_target": unknown;
    readonly "state": "presented" | "approved" | "rejected" | "changes_requested" | "superseded" | "expired" | "canceled";
    readonly "version": unknown;
    readonly "presented_at": unknown;
    readonly "expires_at": unknown;
    readonly "decided"?: {
    readonly "decision": "approve" | "reject" | "request_changes";
    readonly "source": "card" | "chat_reply" | "inbox";
    readonly "decided_by": unknown;
    readonly "decided_at": unknown;
    readonly "intent_id"?: string;
  };
  };
export type VideoProductionProgress = {
    readonly "schema_version": "video_production_progress_v1";
    readonly "job_id": unknown;
    readonly "conversation_id": unknown;
    readonly "project_id": (unknown) | (null);
    readonly "job_status": unknown;
    readonly "production_plan_revision": (unknown) | (null);
    readonly "plan_ref": (unknown) | (null);
    readonly "stages": readonly (unknown)[];
    readonly "attention": readonly ({
    readonly "kind": "qa" | "funding" | "queue" | "review";
    readonly "code": string;
    readonly "step_id"?: "brief" | "research" | "script" | "plan" | "approval" | "audio_media" | "apply_qc" | "preview" | "render";
  })[];
    readonly "launch": {
    readonly "state": "none" | "awaiting_decision" | "accepted" | "handed_off" | "launching" | "queued" | "producing" | "funding_required" | "refused" | "rejected" | "changes_requested";
    readonly "started": boolean;
    readonly "presentation_id"?: string;
    readonly "intent_id"?: string;
    readonly "handoff_id"?: unknown;
    readonly "refusal_reason"?: string;
  };
    readonly "run_event_sequence": unknown;
    readonly "generated_at": unknown;
  };

export const reader = new ContractPackageReader({
  package: "production-launch",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
