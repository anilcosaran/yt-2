// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/composition-project/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/common.schema.json",
    "title": "composition_project_common_v1",
    "description": "Shared definitions of the composition-project v1 package. Ids, hashes, versions and owner refs come from the main packages by $ref (single owner): assistant-runtime common/owner-refs, scope-grants, execution-pin, spend-envelope.",
    "$defs": {
      "EntityKind": {
        "description": "CAS entity kinds of a CompositionDocument (F27). scene_sequence is the parent of structural scene commands; a scene is the parent of its layer order; project_overlays and audio are the project-level parents. template_instance (P06-03) is a document template instance record (template_instances[]).",
        "enum": [
          "scene_sequence",
          "section",
          "scene",
          "layer",
          "project_overlays",
          "audio",
          "caption_track",
          "pending_slot",
          "source_media",
          "canvas",
          "template_instance"
        ]
      },
      "EntityRev": {
        "description": "Per-entity revision for the F27 read_set CAS; the first revision is 1.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
      },
      "WorkingCopyVersion": {
        "description": "Mutable working copy CAS counter of a project; every applied command increments it (base_revision of a command).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Version"
      },
      "SeenWorkingCopyVersion": {
        "description": "TK-33: working_copy_version the user saw when asking for G2/export. The revision is cut only when head == seen (the CAS is P02-07's command); a mismatch returns a conflict and asks for a fresh preview.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Version"
      },
      "Frame": {
        "description": "Integer frame at the document canvas fps.",
        "type": "integer",
        "minimum": 0
      },
      "FrameCount": {
        "type": "integer",
        "minimum": 1
      },
      "FrameRange": {
        "description": "Half-open [start_frame, end_frame) at the canvas fps; end_frame > start_frame (checked by the compiler).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "start_frame",
          "end_frame"
        ],
        "properties": {
          "start_frame": {
            "$ref": "common.schema.json#/$defs/Frame"
          },
          "end_frame": {
            "$ref": "common.schema.json#/$defs/Frame"
          }
        }
      },
      "Rational": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "num",
          "den"
        ],
        "properties": {
          "num": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1000000
          },
          "den": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1000000
          }
        }
      },
      "SourceRange": {
        "description": "Half-open [in_tick, out_tick) on the source media's rational timebase (SourceMedia.probe.timebase); the source is never copied or transcoded per scene.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "in_tick",
          "out_tick"
        ],
        "properties": {
          "in_tick": {
            "type": "integer",
            "minimum": 0
          },
          "out_tick": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "Origin": {
        "description": "TK-32 origin of a command, undo group or revision cut: user, agent (Assistant job) or system.",
        "enum": [
          "user",
          "agent",
          "system"
        ]
      },
      "ActorUserId": {
        "description": "TK-32 actor: the user; in agent/system work the user who started the job (P00-03 job initiator).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "EntityRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "entity_kind",
          "entity_id"
        ],
        "properties": {
          "entity_kind": {
            "$ref": "common.schema.json#/$defs/EntityKind"
          },
          "entity_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "EntityRevRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "entity_kind",
          "entity_id",
          "entity_rev"
        ],
        "properties": {
          "entity_kind": {
            "$ref": "common.schema.json#/$defs/EntityKind"
          },
          "entity_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "entity_rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          }
        }
      },
      "PreparationArtifactRef": {
        "description": "Exact revision of a preparation artifact (VideoBrief/ScriptArtifact/ShotPlan/ProductionPlan owned by P02-01 revision base + P04-15 schemas) or a transcript revision (P06-33/P03-22).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "artifact_kind",
          "artifact_id",
          "artifact_revision"
        ],
        "properties": {
          "artifact_kind": {
            "enum": [
              "video_brief",
              "script",
              "shot_plan",
              "production_plan",
              "transcript"
            ]
          },
          "artifact_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "artifact_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          }
        }
      },
      "RendererPin": {
        "description": "Renderer + render profile revision pinned by a project and copied into each RenderManifest (F43). Chosen by the P00-06 ADR.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "renderer_id",
          "renderer_revision",
          "profile_revision"
        ],
        "properties": {
          "renderer_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "renderer_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "profile_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "FontRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "font_id",
          "font_revision",
          "sha256"
        ],
        "properties": {
          "font_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "font_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "AudioLicenseBinding": {
        "description": "P06-09 (F48): the licence revision of one music/sfx audio dependency of a manifest: which exact Storage object (id + checksum) on which project source, its basis (the platform's licensed catalogue revision, the user's rights declaration, or AI-generated audio under the provider licence), the immutable licence revision (a digest of the licence facts), the separately recorded allowed uses (project use, final distribution, commercial use, raw download, template redistribution), Content ID eligibility and the attribution the licence requires. A dependency without a usable licence is listed as missing or revoked with a reason: a proxy manifest may carry it, a final manifest never (render-manifest.schema.json).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "asset",
          "source_id",
          "role",
          "status"
        ],
        "properties": {
          "asset": {
            "description": "The exact Storage object (id + checksum, Storage owns the ref) the licence is bound to.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
          },
          "source_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "role": {
            "enum": [
              "music",
              "sfx"
            ]
          },
          "status": {
            "enum": [
              "bound",
              "missing",
              "revoked"
            ]
          },
          "reason": {
            "description": "Why the dependency has no usable licence (missing: no catalogue acquisition, rights declaration or generation record; revoked: takedown or a withdrawn declaration).",
            "type": "string",
            "minLength": 1,
            "maxLength": 64
          },
          "basis": {
            "enum": [
              "platform_stock",
              "user_rights_declared",
              "ai_generated"
            ]
          },
          "license_revision": {
            "description": "alr_ + the first 32 hex characters of the sha256 of the canonical licence facts; the same facts always give the same revision.",
            "type": "string",
            "pattern": "^alr_[0-9a-f]{32}$"
          },
          "license_ref": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "allowed_uses": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "uniqueItems": true,
            "items": {
              "enum": [
                "project_use",
                "final_distribution",
                "commercial_use",
                "raw_download",
                "template_redistribution"
              ]
            }
          },
          "content_id_safe": {
            "description": "true: not expected to raise a platform claim; false: may; null: unknown (the user's declaration or the provider terms did not say).",
            "type": [
              "boolean",
              "null"
            ]
          },
          "attribution": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "required",
              "text"
            ],
            "properties": {
              "required": {
                "type": "boolean"
              },
              "text": {
                "type": [
                  "string",
                  "null"
                ],
                "maxLength": 500
              }
            }
          },
          "record": {
            "description": "The owner record the licence facts were read from (ids only; never a URL or a private text).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind"
            ],
            "properties": {
              "kind": {
                "enum": [
                  "catalog_item",
                  "declaration",
                  "generation"
                ]
              },
              "item_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "declaration_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "creation_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "status": {
                  "const": "bound"
                }
              }
            },
            "then": {
              "required": [
                "basis",
                "license_revision",
                "license_ref",
                "allowed_uses",
                "content_id_safe",
                "attribution",
                "record"
              ]
            },
            "else": {
              "required": [
                "reason"
              ]
            }
          }
        ]
      },
      "MotionRevisionRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "motion_id",
          "motion_revision_id",
          "scope",
          "manifest_sha256"
        ],
        "properties": {
          "motion_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "motion_revision_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "scope": {
            "description": "library: reusable Motion owned by Brand; project_private: Q16 LLM Motion scene bound to one project (private immutable usable revision).",
            "enum": [
              "library",
              "project_private"
            ]
          },
          "manifest_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "OperationRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "production_run_id",
          "operation_id"
        ],
        "properties": {
          "production_run_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "operation_id": {
            "description": "P00-03 logical_operation_id of the operation.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      }
    }
  },
  "composition-command.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/composition-command.schema.json",
    "title": "composition_command_v1",
    "description": "The single write envelope of Composition (P00-04 owns it). UI, Chat/Assistant (composition.edit.propose, TK-01; tool name owned by P00-13) and headless paths send the same envelope: base_revision + read_set entity CAS and target entities (F27), idempotency key, TK-32 actor_user_id + origin, undo group and ops[]. ops[] items are P00-13 Motion's edit_op_v1 (referenced in prose until both packages are on main); the receipt status vocabulary (refused/applied/saved/verified/failed) is also P00-13's. Selection and view state are never commands.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "command_id",
      "idempotency_key",
      "project_id",
      "base_revision",
      "read_set",
      "targets",
      "actor_user_id",
      "origin",
      "undo_policy",
      "ops",
      "issued_at"
    ],
    "properties": {
      "schema_version": {
        "const": "composition_command_v1"
      },
      "command_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "idempotency_key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "base_revision": {
        "description": "working_copy_version the command was built on (F27 base_revision).",
        "$ref": "common.schema.json#/$defs/WorkingCopyVersion"
      },
      "read_set": {
        "description": "Every entity the command depends on with the rev it read; structural commands (insert/delete/reorder/split/merge) include their parent sequence.",
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "common.schema.json#/$defs/EntityRevRef"
        }
      },
      "targets": {
        "type": "array",
        "minItems": 1,
        "maxItems": 200,
        "items": {
          "$ref": "common.schema.json#/$defs/EntityRef"
        }
      },
      "actor_user_id": {
        "$ref": "common.schema.json#/$defs/ActorUserId"
      },
      "origin": {
        "$ref": "common.schema.json#/$defs/Origin"
      },
      "job_ref": {
        "description": "Required for agent/system origin: the P00-03 job whose initiator is actor_user_id.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "business_job_id",
          "invocation_cause_id"
        ],
        "properties": {
          "business_job_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "invocation_cause_id": {
            "description": "P00-03 invocation_cause_v1 id.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "operation_ref": {
        "$ref": "common.schema.json#/$defs/OperationRef"
      },
      "undo_policy": {
        "description": "recorded: the command joins undo_group_id (an AI apply is one group). exempt_placeholder: only pending_slot placeholders are touched (TK-32), no undo record and no sequence revision.",
        "enum": [
          "recorded",
          "exempt_placeholder"
        ]
      },
      "undo_group_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "ops": {
        "type": "array",
        "minItems": 1,
        "maxItems": 100,
        "items": {
          "description": "P00-13 motion-spark edit_op_v1 (EditOp catalog, TK-01/TK-19). Validated against the P00-13 catalog; this package checks only the op name.",
          "type": "object",
          "required": [
            "op"
          ],
          "properties": {
            "op": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
            }
          }
        }
      },
      "issued_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "origin": {
              "enum": [
                "agent",
                "system"
              ]
            }
          }
        },
        "then": {
          "required": [
            "job_ref"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "undo_policy": {
              "const": "recorded"
            }
          }
        },
        "then": {
          "required": [
            "undo_group_id"
          ]
        },
        "else": {
          "not": {
            "required": [
              "undo_group_id"
            ]
          }
        }
      }
    ]
  },
  "composition-document.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/composition-document.schema.json",
    "title": "composition_document_v1",
    "description": "Canonical CompositionDocument of a project working copy or of an immutable revision. One document, one timeline (Q14): sections, the ordered scene sequence (scene strip), scenes with typed layers (clip, text, shape, Motion instance, pending slot), project overlays, audio placements and caption tracks. Tracks are not stored: the compiler derives the lanes (document-rules.json track_model). EditTimelineV1 is a derived read-only view (TK-29); every write is a composition_command_v1. schema_version is the F43 document version; reads upcast older versions, writes are current only.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "project_id",
      "working_copy_version",
      "canvas",
      "sections",
      "scene_sequence",
      "scenes",
      "project_overlays",
      "audio",
      "caption_tracks",
      "source_media"
    ],
    "properties": {
      "schema_version": {
        "description": "Current CompositionDocument schema version (F43). Older stored versions are upcast on read (schema-evolution-rules.json); a document is only ever written at this version.",
        "const": 1
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "working_copy_version": {
        "$ref": "common.schema.json#/$defs/WorkingCopyVersion"
      },
      "canvas": {
        "description": "Project format chosen at creation (default 16:9 1080p30, F35); a change is an explicit reframe command.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "aspect_ratio",
          "width",
          "height",
          "fps"
        ],
        "properties": {
          "aspect_ratio": {
            "enum": [
              "16:9",
              "9:16",
              "1:1"
            ]
          },
          "width": {
            "type": "integer",
            "minimum": 16,
            "maximum": 7680
          },
          "height": {
            "type": "integer",
            "minimum": 16,
            "maximum": 7680
          },
          "fps": {
            "$ref": "common.schema.json#/$defs/Rational"
          }
        }
      },
      "brand_kit_ref": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
      },
      "sections": {
        "type": "array",
        "maxItems": 100,
        "items": {
          "description": "F21 Section (script chapter 1:1 by default).",
          "type": "object",
          "additionalProperties": false,
          "required": [
            "section_id",
            "rev",
            "title"
          ],
          "properties": {
            "section_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
            },
            "rev": {
              "$ref": "common.schema.json#/$defs/EntityRev"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "script_chapter_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
            }
          }
        }
      },
      "scene_sequence": {
        "description": "Ordered scene strip; structural scene commands read its rev (F27).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "rev",
          "scene_ids"
        ],
        "properties": {
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "scene_ids": {
            "type": "array",
            "maxItems": 200,
            "uniqueItems": true,
            "items": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
            }
          }
        }
      },
      "scenes": {
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "#/$defs/Scene"
        }
      },
      "project_overlays": {
        "description": "Project-wide overlays above scene content (z-order: project overlay > scene layers > scene background).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "rev",
          "layers"
        ],
        "properties": {
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "layers": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "layer_id",
                "rev",
                "overlay_kind",
                "project_range"
              ],
              "properties": {
                "layer_id": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                },
                "rev": {
                  "$ref": "common.schema.json#/$defs/EntityRev"
                },
                "overlay_kind": {
                  "enum": [
                    "logo",
                    "watermark",
                    "lower_third"
                  ]
                },
                "media": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
                },
                "motion_instance": {
                  "$ref": "#/$defs/MotionInstance"
                },
                "project_range": {
                  "$ref": "common.schema.json#/$defs/FrameRange"
                }
              },
              "oneOf": [
                {
                  "required": [
                    "media"
                  ],
                  "not": {
                    "required": [
                      "motion_instance"
                    ]
                  }
                },
                {
                  "required": [
                    "motion_instance"
                  ],
                  "not": {
                    "required": [
                      "media"
                    ]
                  }
                }
              ]
            }
          }
        }
      },
      "audio": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "rev",
          "placements"
        ],
        "properties": {
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "placements": {
            "type": "array",
            "maxItems": 200,
            "items": {
              "description": "Narration/music/sfx placement: scene-local (scene_id + scene_range) or global (project_range); ducking envelopes belong to AudioMixPlan (P00-13 / P06-63).",
              "type": "object",
              "additionalProperties": false,
              "required": [
                "placement_id",
                "rev",
                "role",
                "source_id",
                "source_range",
                "gain_db"
              ],
              "properties": {
                "placement_id": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                },
                "rev": {
                  "$ref": "common.schema.json#/$defs/EntityRev"
                },
                "role": {
                  "enum": [
                    "narration",
                    "music",
                    "sfx"
                  ]
                },
                "source_id": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                },
                "source_range": {
                  "$ref": "common.schema.json#/$defs/SourceRange"
                },
                "scene_id": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                },
                "scene_range": {
                  "$ref": "common.schema.json#/$defs/FrameRange"
                },
                "project_range": {
                  "$ref": "common.schema.json#/$defs/FrameRange"
                },
                "gain_db": {
                  "type": "number",
                  "minimum": -60,
                  "maximum": 24
                },
                "fade_in_ms": {
                  "description": "P06-63 clip fade-in (linear gain ramp from silence) in milliseconds, applied the same way in preview and final.",
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 60000
                },
                "fade_out_ms": {
                  "description": "P06-63 clip fade-out (linear gain ramp to silence) in milliseconds, applied the same way in preview and final.",
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 60000
                },
                "narration_provenance": {
                  "description": "P06-27: how a narration placement's audio was obtained. supplied_audio (a user/ready recording) is never regenerated without an explicit convert; generated_speech carries the digest of the exact narration spec (text source + exact Voice route + TTS capability + language) the audio was synthesized from, so a later text/voice edit marks only this narration dirty and a caption-only or video-only edit does not. operation_ref names the ProductionRun operation that produced it (late result / accepted-unknown recovery); alignment_ref is the word alignment artifact when the separate alignment capability ran (a TTS duration alone never gives word times). Only narration placements carry it.",
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "source_mode",
                    "spec_sha256"
                  ],
                  "properties": {
                    "source_mode": {
                      "enum": [
                        "supplied_audio",
                        "generated_speech"
                      ]
                    },
                    "spec_sha256": {
                      "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
                    },
                    "operation_ref": {
                      "$ref": "common.schema.json#/$defs/OperationRef"
                    },
                    "alignment_ref": {
                      "$ref": "common.schema.json#/$defs/PreparationArtifactRef"
                    }
                  }
                }
              },
              "oneOf": [
                {
                  "required": [
                    "scene_id",
                    "scene_range"
                  ],
                  "not": {
                    "required": [
                      "project_range"
                    ]
                  }
                },
                {
                  "required": [
                    "project_range"
                  ],
                  "not": {
                    "anyOf": [
                      {
                        "required": [
                          "scene_id"
                        ]
                      },
                      {
                        "required": [
                          "scene_range"
                        ]
                      }
                    ]
                  }
                }
              ]
            }
          },
          "mix_plan": {
            "description": "P06-63 AudioMixPlan of the project in document form (Q57; the P00-13 motion-spark AudioMixPlan fields, referenced in prose like every P00-13 name in this package): bus gain/mute, the deterministic ducking rule (a precomputed gain envelope, never a sidechain), the music bed offset and time-ranged automation envelopes (frames instead of the P00-13 seconds). Clip gain and fades stay on the placements; the compiler derives the P00-13 AudioMixPlan (clips[], final target -14 LUFS / -1 dBTP, F44) for preview and final. Absent = the default plan at rev 1; the audio.adjust / audio.set_duck / audio.automate commands materialize it. Addressed as the `audio` entity `mix_plan`.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "rev",
              "buses",
              "ducking",
              "background_level_offset_db",
              "automation_envelopes"
            ],
            "properties": {
              "rev": {
                "$ref": "common.schema.json#/$defs/EntityRev"
              },
              "buses": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "voice",
                  "source_dialogue",
                  "music",
                  "sfx",
                  "ambience"
                ],
                "properties": {
                  "voice": {
                    "$ref": "#/$defs/AudioMixBus"
                  },
                  "source_dialogue": {
                    "$ref": "#/$defs/AudioMixBus"
                  },
                  "music": {
                    "$ref": "#/$defs/AudioMixBus"
                  },
                  "sfx": {
                    "$ref": "#/$defs/AudioMixBus"
                  },
                  "ambience": {
                    "$ref": "#/$defs/AudioMixBus"
                  }
                }
              },
              "ducking": {
                "description": "Speech ducks the music bus by depth_db with the attack/release ramps (default -12 dB, 150 ms, 400 ms; config).",
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "depth_db",
                  "attack_ms",
                  "release_ms"
                ],
                "properties": {
                  "depth_db": {
                    "type": "number",
                    "minimum": -40,
                    "maximum": 0
                  },
                  "attack_ms": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 2000
                  },
                  "release_ms": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 5000
                  }
                }
              },
              "background_level_offset_db": {
                "description": "Constant music bed level relative to speech while nobody speaks (the persistent music_bed_offset_db preference starts here).",
                "type": "number",
                "minimum": -40,
                "maximum": 12
              },
              "automation_envelopes": {
                "type": "array",
                "maxItems": 64,
                "items": {
                  "description": "Time-ranged gain of one bus over a timeline range, reached and left with ramp_ms linear ramps.",
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "envelope_id",
                    "bus",
                    "project_range",
                    "gain_db",
                    "ramp_ms"
                  ],
                  "properties": {
                    "envelope_id": {
                      "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                    },
                    "bus": {
                      "enum": [
                        "voice",
                        "source_dialogue",
                        "music",
                        "sfx",
                        "ambience"
                      ]
                    },
                    "project_range": {
                      "$ref": "common.schema.json#/$defs/FrameRange"
                    },
                    "gain_db": {
                      "type": "number",
                      "minimum": -60,
                      "maximum": 12
                    },
                    "ramp_ms": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 5000
                    }
                  }
                }
              }
            }
          }
        }
      },
      "caption_tracks": {
        "type": "array",
        "maxItems": 4,
        "items": {
          "description": "Caption cues are derived from the transcript/narration revision word timings (P03-22, TK-29 word anchors).",
          "type": "object",
          "additionalProperties": false,
          "required": [
            "caption_track_id",
            "rev",
            "source",
            "burn_in"
          ],
          "properties": {
            "caption_track_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
            },
            "rev": {
              "$ref": "common.schema.json#/$defs/EntityRev"
            },
            "source": {
              "$ref": "common.schema.json#/$defs/PreparationArtifactRef"
            },
            "style_ref": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
            },
            "burn_in": {
              "description": "F44: captions are burned in; sidecar SRT/VTT is later scope (Q01).",
              "const": true
            }
          }
        }
      },
      "source_media": {
        "type": "array",
        "maxItems": 500,
        "items": {
          "description": "SAHNE \u00a73 SourceMedia: Storage ref projection + probe; analysis is derivative, the source binary is never copied or transcoded.",
          "type": "object",
          "additionalProperties": false,
          "required": [
            "source_id",
            "storage_object",
            "project_asset_grant_id",
            "probe"
          ],
          "properties": {
            "source_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
            },
            "storage_object": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
            },
            "project_asset_grant_id": {
              "description": "P00-07 project_asset_grant_v1 that binds the asset to this project (persistent Storage reference); the source conversation is provenance only.",
              "$ref": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/project-asset-grant.schema.json#/properties/grant_id"
            },
            "probe": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "timebase",
                "vfr",
                "duration_ticks",
                "audio_channels"
              ],
              "properties": {
                "timebase": {
                  "$ref": "common.schema.json#/$defs/Rational"
                },
                "vfr": {
                  "type": "boolean"
                },
                "duration_ticks": {
                  "type": "integer",
                  "minimum": 1
                },
                "audio_channels": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 16
                }
              }
            },
            "transcript": {
              "$ref": "common.schema.json#/$defs/PreparationArtifactRef"
            },
            "analysis_refs": {
              "type": "array",
              "maxItems": 16,
              "items": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
              }
            }
          }
        }
      },
      "template_instances": {
        "description": "P06-03/P06-04 template instances of this project (additive optional field, coordinator-approved note in README): the pinned Brand Template revision, its extension_policy, section states (a disabled optional section's scenes are parked here with their content), locks, project variants and the entity -> blueprint layer map. An empty or freeform project has none.",
        "type": "array",
        "maxItems": 20,
        "items": {
          "$ref": "#/$defs/TemplateInstance"
        }
      }
    },
    "$defs": {
      "Scene": {
        "description": "SAHNE \u00a73 Scene: stable scene_id (reorder never changes identity); one scene per beat by default (F21).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scene_id",
          "rev",
          "origin",
          "timing_policy",
          "section_id",
          "layers"
        ],
        "properties": {
          "scene_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "origin": {
            "description": "Provenance only (SAHNE \u00a73).",
            "enum": [
              "authored",
              "template",
              "generated",
              "source_split"
            ]
          },
          "timing_policy": {
            "enum": [
              "fixed",
              "follow_media",
              "follow_narration"
            ]
          },
          "duration_frames": {
            "$ref": "common.schema.json#/$defs/FrameCount"
          },
          "section_id": {
            "oneOf": [
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              {
                "type": "null"
              }
            ]
          },
          "layout_ref": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
          },
          "template_binding": {
            "description": "P06-03 provenance of a template scene: the instance and the stable local blueprint it was copied from (layout_ref names the exact BrandTemplateRevision).",
            "$ref": "#/$defs/TemplateSceneBinding"
          },
          "narration_binding": {
            "description": "F21: the Beats of this scene (ScriptArtifact revision + stable beat ids).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "script",
              "beat_ids"
            ],
            "properties": {
              "script": {
                "$ref": "common.schema.json#/$defs/PreparationArtifactRef"
              },
              "beat_ids": {
                "type": "array",
                "minItems": 1,
                "maxItems": 64,
                "uniqueItems": true,
                "items": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                }
              }
            }
          },
          "transition_in": {
            "description": "E1-L (D8) the transition from the previous scene into this one (additive optional field; absent = a cut; inert on the first scene). An overlap transition centred on the cut consumes frames from both neighbours and never changes a scene start or the total length.",
            "$ref": "#/$defs/SceneTransition"
          },
          "layers": {
            "description": "Layer order = z-order inside the scene (the scene rev covers its layer order).",
            "type": "array",
            "maxItems": 60,
            "items": {
              "$ref": "#/$defs/Layer"
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "timing_policy": {
                  "const": "fixed"
                }
              }
            },
            "then": {
              "required": [
                "duration_frames"
              ]
            }
          }
        ]
      },
      "Layer": {
        "oneOf": [
          {
            "$ref": "#/$defs/ClipLayer"
          },
          {
            "$ref": "#/$defs/TextLayer"
          },
          {
            "$ref": "#/$defs/ShapeLayer"
          },
          {
            "$ref": "#/$defs/MotionLayer"
          },
          {
            "$ref": "#/$defs/PendingSlotLayer"
          }
        ]
      },
      "ClipLayer": {
        "description": "Video or image clip (ClipInstance of F21) placed from a SourceMedia range.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "layer_id",
          "rev",
          "layer_kind",
          "placement"
        ],
        "properties": {
          "layer_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "layer_kind": {
            "const": "clip"
          },
          "placement": {
            "$ref": "#/$defs/ClipPlacement"
          },
          "transform": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "x",
              "y",
              "scale",
              "rotation_deg"
            ],
            "properties": {
              "x": {
                "type": "number"
              },
              "y": {
                "type": "number"
              },
              "scale": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "rotation_deg": {
                "type": "number"
              },
              "crop": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "left",
                  "top",
                  "right",
                  "bottom"
                ],
                "properties": {
                  "left": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "top": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "right": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "bottom": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  }
                }
              }
            }
          },
          "audio": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "gain_db",
              "muted"
            ],
            "properties": {
              "gain_db": {
                "type": "number",
                "minimum": -60,
                "maximum": 24
              },
              "muted": {
                "type": "boolean"
              }
            }
          },
          "planned_shot_ref": {
            "description": "F21: the PlannedShot this clip materializes (ShotPlan artifact).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "shot_plan",
              "planned_shot_id"
            ],
            "properties": {
              "shot_plan": {
                "$ref": "common.schema.json#/$defs/PreparationArtifactRef"
              },
              "planned_shot_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            }
          },
          "generated_take_ref": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "production_run_id",
              "take_id"
            ],
            "properties": {
              "production_run_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "take_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            }
          },
          "animations": {
            "type": "array",
            "maxItems": 6,
            "items": {
              "$ref": "#/$defs/AnimationSpec"
            }
          },
          "opacity": {
            "description": "Spark editor styling round: the layer's opacity from 0 (fully transparent) to 1 (absent = 1, fully opaque; the ops never write 1, they remove the field). The compiler applies it to the layer group (visibility window included), so enter/exit fades of the content multiply with it. Text, shape and image clip layers only: a video clip is composited by the export's FFmpeg path, which draws no opacity yet, so the op refuses it there.",
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "locked": {
            "description": "Spark editor styling round: the layer is locked in the editor (absent = unlocked; false is never stored). UI-only behaviour: the stage neither selects nor drags a locked layer, the panels still edit it. It never changes the drawn frames (the preview dependency hash leaves it out) and no template lock depends on it.",
            "const": true
          }
        }
      },
      "TextLayer": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "layer_id",
          "rev",
          "layer_kind",
          "text",
          "style",
          "scene_range"
        ],
        "properties": {
          "layer_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "layer_kind": {
            "const": "text"
          },
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "style": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "font",
              "size_px",
              "color"
            ],
            "properties": {
              "font": {
                "$ref": "common.schema.json#/$defs/FontRef"
              },
              "size_px": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "color": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$"
              },
              "align": {
                "enum": [
                  "start",
                  "center",
                  "end"
                ]
              },
              "line_height": {
                "description": "Spark editor styling round: line spacing as a multiple of the font size (absent = the face's own line height). The text engine lays the lines out at size_px * line_height; preview and export draw the stored layout.",
                "type": "number",
                "minimum": 0.5,
                "maximum": 3
              },
              "text_decoration": {
                "description": "Spark editor styling round: underline and/or strikethrough lines drawn in the text colour (absent = none; at least one of them is true when stored).",
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "underline",
                  "strikethrough"
                ],
                "properties": {
                  "underline": {
                    "type": "boolean"
                  },
                  "strikethrough": {
                    "type": "boolean"
                  }
                },
                "anyOf": [
                  {
                    "properties": {
                      "underline": {
                        "const": true
                      }
                    }
                  },
                  {
                    "properties": {
                      "strikethrough": {
                        "const": true
                      }
                    }
                  }
                ]
              },
              "stroke": {
                "description": "Spark editor styling round: an outline around the glyphs, painted behind the fill (absent = none). width_px is the visible outline width outside the glyph edge in canvas pixels.",
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "color",
                  "width_px"
                ],
                "properties": {
                  "color": {
                    "type": "string",
                    "pattern": "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$"
                  },
                  "width_px": {
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 100
                  }
                }
              }
            }
          },
          "scene_range": {
            "$ref": "common.schema.json#/$defs/FrameRange"
          },
          "transform": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "x",
              "y",
              "scale",
              "rotation_deg"
            ],
            "properties": {
              "x": {
                "type": "number"
              },
              "y": {
                "type": "number"
              },
              "scale": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "rotation_deg": {
                "type": "number"
              },
              "crop": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "left",
                  "top",
                  "right",
                  "bottom"
                ],
                "properties": {
                  "left": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "top": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "right": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "bottom": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  }
                }
              }
            }
          },
          "animations": {
            "type": "array",
            "maxItems": 6,
            "items": {
              "$ref": "#/$defs/AnimationSpec"
            }
          },
          "opacity": {
            "description": "Spark editor styling round: the layer's opacity from 0 (fully transparent) to 1 (absent = 1, fully opaque; the ops never write 1, they remove the field). The compiler applies it to the layer group (visibility window included), so enter/exit fades of the content multiply with it. Text, shape and image clip layers only: a video clip is composited by the export's FFmpeg path, which draws no opacity yet, so the op refuses it there.",
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "locked": {
            "description": "Spark editor styling round: the layer is locked in the editor (absent = unlocked; false is never stored). UI-only behaviour: the stage neither selects nor drags a locked layer, the panels still edit it. It never changes the drawn frames (the preview dependency hash leaves it out) and no template lock depends on it.",
            "const": true
          }
        }
      },
      "ShapeLayer": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "layer_id",
          "rev",
          "layer_kind",
          "shape",
          "fill",
          "scene_range"
        ],
        "properties": {
          "layer_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "layer_kind": {
            "const": "shape"
          },
          "shape": {
            "enum": [
              "rect",
              "ellipse",
              "line"
            ]
          },
          "size": {
            "description": "Box of a rect or ellipse in canvas pixels, placed with its top-left corner at transform.x/y (centred on the canvas without a transform). Absent: the canvas-sized box of the first document v1. A line has no box.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "width_px",
              "height_px"
            ],
            "properties": {
              "width_px": {
                "type": "number",
                "minimum": 1,
                "maximum": 16384
              },
              "height_px": {
                "type": "number",
                "minimum": 1,
                "maximum": 16384
              }
            }
          },
          "corner_radius_px": {
            "description": "Corner radius of a rect in canvas pixels (a pill is height / 2). The compiler draws at most half of the shorter side. Absent: square corners. Not for ellipse or line.",
            "type": "number",
            "minimum": 0,
            "maximum": 16384
          },
          "fill": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$"
          },
          "scene_range": {
            "$ref": "common.schema.json#/$defs/FrameRange"
          },
          "transform": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "x",
              "y",
              "scale",
              "rotation_deg"
            ],
            "properties": {
              "x": {
                "type": "number"
              },
              "y": {
                "type": "number"
              },
              "scale": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "rotation_deg": {
                "type": "number"
              },
              "crop": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "left",
                  "top",
                  "right",
                  "bottom"
                ],
                "properties": {
                  "left": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "top": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "right": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "bottom": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  }
                }
              }
            }
          },
          "animations": {
            "type": "array",
            "maxItems": 6,
            "items": {
              "$ref": "#/$defs/AnimationSpec"
            }
          },
          "opacity": {
            "description": "Spark editor styling round: the layer's opacity from 0 (fully transparent) to 1 (absent = 1, fully opaque; the ops never write 1, they remove the field). The compiler applies it to the layer group (visibility window included), so enter/exit fades of the content multiply with it. Text, shape and image clip layers only: a video clip is composited by the export's FFmpeg path, which draws no opacity yet, so the op refuses it there.",
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "locked": {
            "description": "Spark editor styling round: the layer is locked in the editor (absent = unlocked; false is never stored). UI-only behaviour: the stage neither selects nor drags a locked layer, the panels still edit it. It never changes the drawn frames (the preview dependency hash leaves it out) and no template lock depends on it.",
            "const": true
          }
        }
      },
      "MotionLayer": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "layer_id",
          "rev",
          "layer_kind",
          "instance",
          "scene_range"
        ],
        "properties": {
          "layer_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "layer_kind": {
            "const": "motion_instance"
          },
          "instance": {
            "$ref": "#/$defs/MotionInstance"
          },
          "scene_range": {
            "$ref": "common.schema.json#/$defs/FrameRange"
          },
          "transform": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "x",
              "y",
              "scale",
              "rotation_deg"
            ],
            "properties": {
              "x": {
                "type": "number"
              },
              "y": {
                "type": "number"
              },
              "scale": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "rotation_deg": {
                "type": "number"
              },
              "crop": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "left",
                  "top",
                  "right",
                  "bottom"
                ],
                "properties": {
                  "left": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "top": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "right": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "bottom": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  }
                }
              }
            }
          },
          "animations": {
            "type": "array",
            "maxItems": 6,
            "items": {
              "$ref": "#/$defs/AnimationSpec"
            }
          },
          "locked": {
            "description": "Spark editor styling round: the layer is locked in the editor (absent = unlocked; false is never stored). UI-only behaviour: the stage neither selects nor drags a locked layer, the panels still edit it. It never changes the drawn frames (the preview dependency hash leaves it out) and no template lock depends on it.",
            "const": true
          }
        }
      },
      "PendingSlotLayer": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "layer_id",
          "rev",
          "layer_kind",
          "operation_ref",
          "slot_state",
          "expected_media_kind",
          "scene_range"
        ],
        "properties": {
          "layer_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "layer_kind": {
            "const": "pending_slot"
          },
          "operation_ref": {
            "$ref": "common.schema.json#/$defs/OperationRef"
          },
          "slot_state": {
            "description": "Placeholder shown while the operation runs (s\u0131rada / \u00fcretiliyor / haz\u0131r / ba\u015far\u0131s\u0131z). TK-32: placeholder records never enter the undo stack or the sequence revision.",
            "enum": [
              "queued",
              "producing",
              "ready",
              "failed"
            ]
          },
          "expected_media_kind": {
            "enum": [
              "video",
              "image",
              "audio"
            ]
          },
          "scene_range": {
            "$ref": "common.schema.json#/$defs/FrameRange"
          }
        }
      },
      "ClipPlacement": {
        "description": "SAHNE \u00a73 ClipPlacement: exactly one of scene_range (scene-local) or project_range (global); local and global are never both writable, the compiler derives global time.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source_id",
          "source_range"
        ],
        "properties": {
          "source_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "source_range": {
            "$ref": "common.schema.json#/$defs/SourceRange"
          },
          "scene_range": {
            "$ref": "common.schema.json#/$defs/FrameRange"
          },
          "project_range": {
            "$ref": "common.schema.json#/$defs/FrameRange"
          },
          "hold_last_frame_frames": {
            "description": "P06-03/P06-27 declared `hold` fit: after its source range ends, the clip holds its last frame for this many frames (the scene range covers source frames + hold). Render support follows (P06-45); until then scene_compiler@1 does not composite video clips (video_layer_not_compiled).",
            "$ref": "common.schema.json#/$defs/FrameCount"
          }
        },
        "oneOf": [
          {
            "required": [
              "scene_range"
            ],
            "not": {
              "required": [
                "project_range"
              ]
            }
          },
          {
            "required": [
              "project_range"
            ],
            "not": {
              "required": [
                "scene_range"
              ]
            }
          }
        ]
      },
      "SceneTransition": {
        "description": "E1-L (D8) a scene boundary transition: a kind of the versioned catalogue `scene-transitions@1` (fade .. blur) or `scene-transitions@2` (the Spark effects library's batch 1a: flash .. rotate_in; written only while the gateway's COMPOSITION_TRANSITIONS_V2_ENABLED is open) (a cut is the absence of the field, never a stored kind), a length in frames and a few typed parameters. Never free keyframes or code; the compiler turns it into Motion IR tweens.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "duration_frames"
        ],
        "properties": {
          "kind": {
            "enum": [
              "fade",
              "dip_to_color",
              "slide",
              "push",
              "wipe",
              "zoom",
              "blur",
              "flash",
              "whip_pan",
              "cross_zoom",
              "zoom_blur",
              "spin",
              "zoom_spin",
              "squeeze",
              "stretch",
              "cover",
              "uncover",
              "bounce_in",
              "shake",
              "diagonal_wipe",
              "rotate_in"
            ]
          },
          "duration_frames": {
            "description": "Requested length; a neighbour gives at most half of its own length to each side, so the compiler may shorten it (reported, never silent).",
            "type": "integer",
            "minimum": 2,
            "maximum": 300
          },
          "params": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "direction": {
                "description": "slide, push, wipe, whip_pan, squeeze, cover, bounce_in: left|right|up|down (where the new picture or the moving edge travels); uncover: where the old picture travels; zoom, zoom_blur: in|out; spin, zoom_spin, rotate_in: cw|ccw; diagonal_wipe: up_left|up_right|down_left|down_right. The catalogue says which kind takes which.",
                "enum": [
                  "left",
                  "right",
                  "up",
                  "down",
                  "in",
                  "out",
                  "cw",
                  "ccw",
                  "up_left",
                  "up_right",
                  "down_left",
                  "down_right"
                ]
              },
              "color": {
                "description": "dip_to_color only: the colour the old scene dips into (default #000000).",
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "easing": {
                "description": "flash, bounce_in and shake keep their own timing and take no easing.",
                "enum": [
                  "linear",
                  "ease_in",
                  "ease_out",
                  "ease_in_out"
                ]
              }
            }
          }
        }
      },
      "AnimationSpec": {
        "description": "SAHNE \u00a73 AnimationSpec (enter/exit/emphasis preset). Not Motion.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "animation_id",
          "phase",
          "preset_ref",
          "params",
          "anchor"
        ],
        "properties": {
          "animation_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "phase": {
            "enum": [
              "enter",
              "exit",
              "emphasis"
            ]
          },
          "preset_ref": {
            "description": "Versioned allowlist preset (typed scene compiler); never free keyframes or code.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "preset_id",
              "preset_revision"
            ],
            "properties": {
              "preset_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "preset_revision": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
              }
            }
          },
          "params": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "duration_frames",
              "easing"
            ],
            "properties": {
              "duration_frames": {
                "$ref": "common.schema.json#/$defs/FrameCount"
              },
              "easing": {
                "enum": [
                  "linear",
                  "ease_in",
                  "ease_out",
                  "ease_in_out"
                ]
              },
              "direction": {
                "enum": [
                  "none",
                  "up",
                  "down",
                  "left",
                  "right"
                ]
              },
              "stagger_frames": {
                "type": "integer",
                "minimum": 0
              }
            }
          },
          "anchor": {
            "$ref": "#/$defs/Anchor"
          }
        }
      },
      "Anchor": {
        "description": "SAHNE \u00a73 Anchor union; resolved to an integer frame at compile time and reported in the RenderManifest. A changed/deleted word makes the anchor unresolved: preview warns, final render is blocked.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind"
            ],
            "properties": {
              "kind": {
                "const": "scene_start"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind"
            ],
            "properties": {
              "kind": {
                "const": "scene_end"
              }
            }
          },
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
                "type": "integer"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "transcript_or_narration",
              "word_id",
              "offset_frames"
            ],
            "properties": {
              "kind": {
                "const": "word"
              },
              "transcript_or_narration": {
                "$ref": "common.schema.json#/$defs/PreparationArtifactRef"
              },
              "word_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "offset_frames": {
                "type": "integer"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "layer_id",
              "phase"
            ],
            "properties": {
              "kind": {
                "const": "after"
              },
              "layer_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "phase": {
                "enum": [
                  "enter",
                  "exit",
                  "emphasis"
                ]
              }
            }
          }
        ]
      },
      "MotionInstance": {
        "description": "KARAR-BEKLEYEN-MOTION-EDITORU instance: motion_revision + parameter values + parameter_schema_hash + dependency snapshot + instance id. Spark edits only the manifest's exposed text/color/media/duration values (motion_exposure_v1); structure changes go to the Motion screen as a new revision.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "instance_id",
          "motion_ref",
          "parameter_schema_hash",
          "parameter_values",
          "dependency_snapshot_sha256"
        ],
        "properties": {
          "instance_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "motion_ref": {
            "$ref": "common.schema.json#/$defs/MotionRevisionRef"
          },
          "parameter_schema_hash": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "parameter_values": {
            "type": "array",
            "maxItems": 64,
            "items": {
              "$ref": "#/$defs/ParameterValue"
            }
          },
          "dependency_snapshot_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "motion_state": {
            "$ref": "#/$defs/MotionInstanceState"
          }
        }
      },
      "MotionInstanceState": {
        "description": "P06-46 document v2 (additive v1 note; schema_version stays 1): the typed Motion scene state Composition owns over the pinned Brand MotionRevision (the Kal\u0131p). The compiled Motion IR is never stored: it is derived deterministically from motion_ref + parameter_values + this state and recompiled on every edit. Absent = a v1 instance whose P00-13 motion-spark EditOps are refused (motion_override_set_unavailable).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ir_version",
          "blueprint_ref",
          "energy",
          "ratio",
          "video_style",
          "overrides",
          "handle_versions"
        ],
        "properties": {
          "ir_version": {
            "const": "motion-ir@1"
          },
          "blueprint_ref": {
            "description": "`id@revision` of the library pattern the motion_ref revision carries (P00-13 motion-spark SemverRevisionRef); swapBlueprint changes both together.",
            "type": "string",
            "pattern": "^[a-z][a-z0-9_-]*@[0-9]+$"
          },
          "energy": {
            "description": "Q34 Enerji (P00-13 motion-spark Energy).",
            "enum": [
              "sakin",
              "dengeli",
              "canli"
            ]
          },
          "ratio": {
            "description": "Ratio variant the instance compiles in (P00-13 motion-spark RatioToken).",
            "enum": [
              "16:9",
              "9:16",
              "1:1"
            ]
          },
          "shot": {
            "description": "P00-13 motion-spark MotionShotSpec fields other than blueprint_ref, slots, energy and ratio (posture, windows, camera, seam_in, seam_out, sfx_cues). Validated by the P00-13 motion-spark reader at the Composition boundary; absent = the pattern's own demo shot.",
            "type": "object"
          },
          "video_style": {
            "$ref": "#/$defs/MotionStateVideoStyle"
          },
          "overrides": {
            "description": "TK-23 instance OverrideSet: sparse `handle + path -> value` deltas over the compiled IR. Each entry keeps the element identity it was authored against, so a Kal\u0131p/Enerji recompile or a revision upgrade migrates matching entries and turns the rest into explicit conflicts.",
            "type": "array",
            "maxItems": 256,
            "items": {
              "$ref": "#/$defs/MotionOverrideEntry"
            }
          },
          "added_tracks": {
            "description": "IR tracks added by EditOps (addTween, splitTween, addCameraMove) with their TK-23 handles.",
            "type": "array",
            "maxItems": 32,
            "items": {
              "$ref": "#/$defs/MotionAddedTrack"
            }
          },
          "added_anchors": {
            "description": "Named anchors added by setAnchor/setTiming/addCameraMove for `after`/`word`/`beat` window starts.",
            "type": "array",
            "maxItems": 32,
            "items": {
              "$ref": "#/$defs/MotionAddedAnchor"
            }
          },
          "handle_versions": {
            "description": "Per-handle CAS counter for the EditOp expected_version: every compiled element starts at version 1 (absent here); each applied EditOp bumps the handles it changes.",
            "type": "array",
            "maxItems": 512,
            "items": {
              "$ref": "#/$defs/MotionHandleVersion"
            }
          }
        }
      },
      "MotionHandle": {
        "description": "TK-23 handle (P00-13 motion-spark Handle): role + order derived by the compiler, never author-assigned.",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*#[0-9]+$"
      },
      "MotionHandleBasis": {
        "description": "TK-23 derivation inputs kept with an override so a migration can tell a re-used handle string from the same element.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "role",
          "slot_key",
          "list_index"
        ],
        "properties": {
          "role": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64
          },
          "slot_key": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 64
          },
          "list_index": {
            "type": [
              "integer",
              "null"
            ],
            "minimum": 0
          }
        }
      },
      "MotionOverrideEntry": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "handle",
          "path",
          "value",
          "basis",
          "element_kind"
        ],
        "properties": {
          "handle": {
            "$ref": "#/$defs/MotionHandle"
          },
          "path": {
            "description": "Element-relative path: text, media_ref, hidden, props.<property>, box.<x|y>, tween.<field>, camera.<field>, seam.<field>, media.<field> or $removed.",
            "type": "string",
            "pattern": "^(\\$removed|[a-z_]+(\\.[a-z_]+)?)$"
          },
          "value": {
            "description": "JSON value of the field; null clears an optional tween field (from/to/keyframes/stagger/ease_each)."
          },
          "basis": {
            "$ref": "#/$defs/MotionHandleBasis"
          },
          "element_kind": {
            "description": "Node kind or track kind of the element when the override was authored.",
            "enum": [
              "world",
              "camera",
              "group",
              "text",
              "image",
              "video",
              "shape",
              "svg",
              "kit_component",
              "code_component",
              "tween",
              "timeline",
              "camera_phase",
              "seam",
              "media_window",
              "sfx"
            ]
          }
        }
      },
      "MotionAddedTrack": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "handle",
          "basis",
          "track"
        ],
        "properties": {
          "handle": {
            "$ref": "#/$defs/MotionHandle"
          },
          "basis": {
            "$ref": "#/$defs/MotionHandleBasis"
          },
          "anchor_handle": {
            "description": "Element the added track depends on (tween target / camera focus); a recompile that loses it turns the addition into an explicit conflict.",
            "$ref": "#/$defs/MotionHandle"
          },
          "track": {
            "description": "One top-level motion-ir@1 track (tween or camera_phase) as the P06-43 IR validator accepts it; its `handle` equals the entry handle.",
            "type": "object"
          }
        }
      },
      "MotionAddedAnchor": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "anchor_id",
          "anchor"
        ],
        "properties": {
          "anchor_id": {
            "type": "string",
            "pattern": "^edit_[a-z0-9_]{1,48}$"
          },
          "anchor": {
            "description": "P00-13 motion-spark Anchor (scene_offset | word | beat | after(handle)).",
            "type": "object"
          }
        }
      },
      "MotionHandleVersion": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "handle",
          "version"
        ],
        "properties": {
          "handle": {
            "$ref": "#/$defs/MotionHandle"
          },
          "version": {
            "type": "integer",
            "minimum": 2
          }
        }
      },
      "MotionStateVideoStyle": {
        "description": "The VideoStyle snapshot the instance compiles with (P06-36): its ref and digest plus the colour and typography roles the pattern compiler reads, so an edit recompiles without a Brand call and a later Kit change never restyles the instance silently.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "preset_ref",
          "snapshot_sha256",
          "color_roles",
          "typography_roles"
        ],
        "properties": {
          "preset_ref": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "snapshot_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "color_roles": {
            "type": "object"
          },
          "typography_roles": {
            "type": "object"
          }
        }
      },
      "ParameterValue": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "parameter_id",
          "kind",
          "value"
        ],
        "properties": {
          "parameter_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "kind": {
            "enum": [
              "text",
              "color",
              "media",
              "duration"
            ]
          },
          "value": {
            "oneOf": [
              {
                "type": "string",
                "maxLength": 2000
              },
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
              },
              {
                "type": "integer",
                "minimum": 1
              }
            ]
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "media"
                }
              }
            },
            "then": {
              "properties": {
                "value": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "duration"
                }
              }
            },
            "then": {
              "properties": {
                "value": {
                  "type": "integer",
                  "minimum": 1
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "color"
                }
              }
            },
            "then": {
              "properties": {
                "value": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$"
                }
              }
            }
          }
        ]
      },
      "AudioMixBus": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "gain_db",
          "mute"
        ],
        "properties": {
          "gain_db": {
            "type": "number",
            "minimum": -60,
            "maximum": 24
          },
          "mute": {
            "type": "boolean"
          }
        }
      },
      "TemplateLocalId": {
        "description": "Stable template-local id (same vocabulary as brand-template v1 LocalId; referenced in prose like P00-13 motion-spark).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z0-9_]+)*$",
        "maxLength": 64
      },
      "TemplateSceneBinding": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "instance_id",
          "blueprint_local_id",
          "section_local_id",
          "repeat_index"
        ],
        "properties": {
          "instance_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "blueprint_local_id": {
            "$ref": "#/$defs/TemplateLocalId"
          },
          "section_local_id": {
            "description": "null for a scene added from the Scene Library (extension scene).",
            "oneOf": [
              {
                "$ref": "#/$defs/TemplateLocalId"
              },
              {
                "type": "null"
              }
            ]
          },
          "repeat_index": {
            "type": "integer",
            "minimum": 0,
            "maximum": 19
          }
        }
      },
      "TemplateLockProperty": {
        "description": "brand-template v1 LockProperty.",
        "enum": [
          "structure",
          "content",
          "style",
          "position",
          "timing"
        ]
      },
      "TemplateInstance": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "instance_id",
          "rev",
          "template_ref",
          "compiler_profile",
          "template_type",
          "extension_policy",
          "options",
          "sections",
          "scene_library",
          "blueprint_ids",
          "entity_bindings",
          "locks",
          "variants"
        ],
        "properties": {
          "instance_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          },
          "template_ref": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
          },
          "compiler_profile": {
            "const": "template_compile@2"
          },
          "template_type": {
            "description": "brand-template v1 template_type (P00-13 motion-spark canonical-enums template_types).",
            "enum": [
              "tanitim_motion_film",
              "slayt_egitim",
              "konsept_video",
              "program_formati",
              "ham_video_formati",
              "sosyal_kanvas_dikey",
              "yorum_tepki_derleme"
            ]
          },
          "extension_policy": {
            "description": "Pinned Add Scene policy (brand-template v1 ExtensionPolicy); UI, Chat and headless commands apply it.",
            "enum": [
              "freeform",
              "approved_scene_only",
              "current_template_only",
              "locked_sequence"
            ]
          },
          "options": {
            "type": "array",
            "maxItems": 16,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "option_id",
                "enabled"
              ],
              "properties": {
                "option_id": {
                  "$ref": "#/$defs/TemplateLocalId"
                },
                "enabled": {
                  "type": "boolean"
                }
              }
            }
          },
          "sections": {
            "type": "array",
            "maxItems": 16,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "section_local_id",
                "presence",
                "state",
                "blueprint_local_ids",
                "parked"
              ],
              "properties": {
                "section_local_id": {
                  "$ref": "#/$defs/TemplateLocalId"
                },
                "presence": {
                  "enum": [
                    "required",
                    "optional",
                    "conditional",
                    "repeatable"
                  ]
                },
                "state": {
                  "description": "enabled: its scenes are in the strip; disabled: parked (content kept, not rendered or counted); condition_false: the condition was false at compile, nothing was laid out.",
                  "enum": [
                    "enabled",
                    "disabled",
                    "condition_false"
                  ]
                },
                "blueprint_local_ids": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 8,
                  "items": {
                    "$ref": "#/$defs/TemplateLocalId"
                  }
                },
                "repeat": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "count",
                    "min",
                    "max"
                  ],
                  "properties": {
                    "count": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 20
                    },
                    "min": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 20
                    },
                    "max": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 20
                    }
                  }
                },
                "parked": {
                  "description": "Scenes of a disabled section, in strip order, with their scene-local audio; restored at the section position when the section is enabled again.",
                  "type": "array",
                  "maxItems": 160,
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "scene",
                      "audio"
                    ],
                    "properties": {
                      "scene": {
                        "$ref": "#/$defs/Scene"
                      },
                      "audio": {
                        "type": "array",
                        "maxItems": 50,
                        "items": {
                          "$ref": "#/properties/audio/properties/placements/items"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "scene_library": {
            "type": "array",
            "maxItems": 32,
            "uniqueItems": true,
            "items": {
              "$ref": "#/$defs/TemplateLocalId"
            }
          },
          "blueprint_ids": {
            "type": "array",
            "minItems": 1,
            "maxItems": 32,
            "uniqueItems": true,
            "items": {
              "$ref": "#/$defs/TemplateLocalId"
            }
          },
          "entity_bindings": {
            "description": "Which blueprint layer/slot a concrete layer or caption track came from (slot rebind, lock checks).",
            "type": "array",
            "maxItems": 800,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "entity_kind",
                "entity_id",
                "blueprint_local_id",
                "layer_local_id",
                "slot_id",
                "repeat_index"
              ],
              "properties": {
                "entity_kind": {
                  "enum": [
                    "layer",
                    "caption_track"
                  ]
                },
                "entity_id": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                },
                "blueprint_local_id": {
                  "oneOf": [
                    {
                      "$ref": "#/$defs/TemplateLocalId"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "layer_local_id": {
                  "oneOf": [
                    {
                      "$ref": "#/$defs/TemplateLocalId"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "slot_id": {
                  "oneOf": [
                    {
                      "$ref": "#/$defs/TemplateLocalId"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "repeat_index": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 19
                },
                "media_fit": {
                  "description": "Declared fit of the media slot this clip layer came from (P06-27 media_fit map of the narration timing).",
                  "enum": [
                    "trim",
                    "hold",
                    "loop",
                    "reject"
                  ]
                }
              }
            }
          },
          "locks": {
            "type": "array",
            "maxItems": 64,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "lock_id",
                "target_kind",
                "blueprint_local_id",
                "layer_local_id",
                "locked_properties"
              ],
              "properties": {
                "lock_id": {
                  "$ref": "#/$defs/TemplateLocalId"
                },
                "target_kind": {
                  "enum": [
                    "scene",
                    "layer"
                  ]
                },
                "blueprint_local_id": {
                  "$ref": "#/$defs/TemplateLocalId"
                },
                "layer_local_id": {
                  "oneOf": [
                    {
                      "$ref": "#/$defs/TemplateLocalId"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "locked_properties": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 5,
                  "uniqueItems": true,
                  "items": {
                    "$ref": "#/$defs/TemplateLockProperty"
                  }
                }
              }
            }
          },
          "variants": {
            "description": "Explicit project variants of a lock (K309 kilit d\u0131\u015f\u0131 istek): the lock no longer applies to this entity in this project; the saved template never changes.",
            "type": "array",
            "maxItems": 200,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "lock_id",
                "entity_id",
                "property"
              ],
              "properties": {
                "lock_id": {
                  "$ref": "#/$defs/TemplateLocalId"
                },
                "entity_id": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                },
                "property": {
                  "$ref": "#/$defs/TemplateLockProperty"
                }
              }
            }
          },
          "narration_bindings": {
            "description": "P06-27 narration slots of the instance's scenes (NarrationSlotSpec inputs): generated speech names the bound text layer and the exact Voice route; supplied audio names the attached audio source. The spec digest is derived from them (never stored stale).",
            "type": "array",
            "maxItems": 200,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "narration_id",
                "scene_id",
                "source_mode",
                "text_layer_id",
                "voice_route",
                "audio_source_id"
              ],
              "properties": {
                "narration_id": {
                  "$ref": "#/$defs/TemplateLocalId"
                },
                "scene_id": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                },
                "source_mode": {
                  "enum": [
                    "supplied_audio",
                    "generated_speech"
                  ]
                },
                "text_layer_id": {
                  "oneOf": [
                    {
                      "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "voice_route": {
                  "oneOf": [
                    {
                      "type": "object",
                      "additionalProperties": false,
                      "required": [
                        "voice",
                        "capability",
                        "language"
                      ],
                      "properties": {
                        "voice": {
                          "type": "object",
                          "additionalProperties": false,
                          "required": [
                            "owner_bc",
                            "resource_id"
                          ],
                          "properties": {
                            "owner_bc": {
                              "const": "voice"
                            },
                            "resource_id": {
                              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                            },
                            "revision": {
                              "oneOf": [
                                {
                                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                                },
                                {
                                  "type": "null"
                                }
                              ]
                            }
                          }
                        },
                        "capability": {
                          "type": "object",
                          "additionalProperties": false,
                          "required": [
                            "node_type",
                            "model_id"
                          ],
                          "properties": {
                            "node_type": {
                              "const": "speech_generate@1"
                            },
                            "model_id": {
                              "type": "string",
                              "minLength": 1,
                              "maxLength": 200
                            }
                          }
                        },
                        "language": {
                          "type": "string",
                          "minLength": 2,
                          "maxLength": 35
                        }
                      }
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "audio_source_id": {
                  "oneOf": [
                    {
                      "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
  },
  "composition-project.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/composition-project.schema.json",
    "title": "composition_project_v1",
    "description": "Composition project record. Extends the #294 record composition.composition_projects (cprj_ id, tenant + owner scoped, private, schema_version) without contradicting it: every existing column keeps its name, type and check; the added fields are the working copy CAS counter, head revision, renderer pin and lifecycle state. client_request_id is the plan's creation_intent_id (dedupe per tenant + owner). Roles, presence and shared visibility arrive with P02-01 (F41) through P00-07 visibility_change.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "tenant_id",
      "channel_id",
      "owner_user_id",
      "title",
      "aspect_ratio",
      "visibility",
      "schema_version",
      "client_request_id",
      "request_fingerprint",
      "working_copy_version",
      "head_revision_id",
      "renderer_pin",
      "lifecycle_state",
      "created_at",
      "updated_at"
    ],
    "properties": {
      "id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "tenant_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "channel_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "owner_user_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "aspect_ratio": {
        "description": "#294 check; the document canvas must match it (inv_canvas_matches_aspect_ratio). Changing it is an explicit reframe command (F35).",
        "enum": [
          "16:9",
          "9:16",
          "1:1"
        ]
      },
      "visibility": {
        "description": "#294 check allows only private; shared needs the P00-07 visibility_change + explicit grants (P02-01).",
        "const": "private"
      },
      "schema_version": {
        "description": "CompositionDocument schema_version currently written for the working copy (#294 default 1, F43).",
        "type": "integer",
        "minimum": 1
      },
      "client_request_id": {
        "description": "#294 create idempotency key = the plan's creation_intent_id; unique per tenant + owner; same key + other payload is a conflict.",
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{8,128}$"
      },
      "request_fingerprint": {
        "description": "#294 sha256 of the normalized create payload (server-private, never in the public DTO).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "working_copy_version": {
        "$ref": "common.schema.json#/$defs/WorkingCopyVersion"
      },
      "head_revision_id": {
        "oneOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          {
            "type": "null"
          }
        ]
      },
      "renderer_pin": {
        "$ref": "common.schema.json#/$defs/RendererPin"
      },
      "lifecycle_state": {
        "description": "active; archived (user); soft_deleted (30-day soft delete before hard delete, F32 \u2014 retention mechanics P02-04/P07-08).",
        "enum": [
          "active",
          "archived",
          "soft_deleted"
        ]
      },
      "created_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "updated_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "composition-revision.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/composition-revision.schema.json",
    "title": "composition_revision_v1",
    "description": "Immutable revision of a project document (F28). Cut on explicit save, render/G2 request, manual export, template/element save, import or pre-migration, and as an automatic checkpoint every 10 minutes of active editing. Manual and rendered revisions are permanent; automatic checkpoints are kept 30 days or the last 20, whichever keeps more (Q110), and an expired checkpoint releases its media lease. Restoring a revision writes a new working copy and never deletes history.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "revision_id",
      "project_id",
      "revision_number",
      "parent_revision_id",
      "cut_from_working_copy_version",
      "document_schema_version",
      "document_sha256",
      "cut_reason",
      "created_by",
      "created_at",
      "lease_released_at"
    ],
    "properties": {
      "schema_version": {
        "const": "composition_revision_v1"
      },
      "revision_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "revision_number": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
      },
      "parent_revision_id": {
        "oneOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          {
            "type": "null"
          }
        ]
      },
      "cut_from_working_copy_version": {
        "$ref": "common.schema.json#/$defs/WorkingCopyVersion"
      },
      "seen_working_copy_version": {
        "$ref": "common.schema.json#/$defs/SeenWorkingCopyVersion"
      },
      "document_schema_version": {
        "type": "integer",
        "minimum": 1
      },
      "document_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "cut_reason": {
        "enum": [
          "manual_save",
          "render_request",
          "g2_request",
          "manual_export",
          "template_save",
          "element_save",
          "import",
          "pre_migration",
          "auto_checkpoint"
        ]
      },
      "created_by": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "actor_user_id",
          "origin"
        ],
        "properties": {
          "actor_user_id": {
            "$ref": "common.schema.json#/$defs/ActorUserId"
          },
          "origin": {
            "$ref": "common.schema.json#/$defs/Origin"
          }
        }
      },
      "created_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "lease_released_at": {
        "oneOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
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
            "cut_reason": {
              "enum": [
                "render_request",
                "g2_request",
                "manual_export"
              ]
            }
          }
        },
        "then": {
          "required": [
            "seen_working_copy_version"
          ]
        },
        "else": {
          "not": {
            "required": [
              "seen_working_copy_version"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "cut_reason": {
              "not": {
                "const": "auto_checkpoint"
              }
            }
          }
        },
        "then": {
          "properties": {
            "lease_released_at": {
              "type": "null"
            }
          }
        }
      }
    ]
  },
  "motion-exposure.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/motion-exposure.schema.json",
    "title": "motion_exposure_v1",
    "description": "Exposed-parameter manifest of an immutable MotionRevision as Composition consumes it (P00-04 owns the exposed parameter / instance / revision contract; the reusable Motion is Brand's, the Motion IR is P00-13's). Source and manifest are validated and published together; source code cannot create permissions outside the manifest.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "motion",
      "source_sha256",
      "parameter_schema_hash",
      "renderer_profile_revision",
      "fps",
      "aspect_ratios",
      "timing",
      "parameters",
      "dependencies"
    ],
    "properties": {
      "schema_version": {
        "const": "motion_exposure_v1"
      },
      "motion": {
        "$ref": "common.schema.json#/$defs/MotionRevisionRef"
      },
      "source_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "parameter_schema_hash": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "renderer_profile_revision": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "fps": {
        "$ref": "common.schema.json#/$defs/Rational"
      },
      "aspect_ratios": {
        "type": "array",
        "minItems": 1,
        "uniqueItems": true,
        "items": {
          "enum": [
            "16:9",
            "9:16",
            "1:1"
          ]
        }
      },
      "timing": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enter",
          "hold",
          "exit"
        ],
        "properties": {
          "enter": {
            "enum": [
              "fixed",
              "stretch",
              "loop"
            ]
          },
          "hold": {
            "enum": [
              "fixed",
              "stretch",
              "loop"
            ]
          },
          "exit": {
            "enum": [
              "fixed",
              "stretch",
              "loop"
            ]
          }
        }
      },
      "parameters": {
        "type": "array",
        "minItems": 0,
        "maxItems": 64,
        "items": {
          "$ref": "#/$defs/Parameter"
        }
      },
      "dependencies": {
        "type": "array",
        "maxItems": 64,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "ref_id",
            "sha256"
          ],
          "properties": {
            "kind": {
              "enum": [
                "font",
                "asset"
              ]
            },
            "ref_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
            },
            "sha256": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
            }
          }
        }
      }
    },
    "$defs": {
      "Parameter": {
        "description": "Exposed parameter. Spark v1 edits only text, color, media and duration (KARAR-BEKLEYEN-MOTION-EDITORU); number/enum/boolean are authoring/Test Data and template defaults.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "parameter_id",
          "kind",
          "spark_editable",
          "required"
        ],
        "properties": {
          "parameter_id": {
            "description": "Stable parameter id; upgrade keeps overrides only for the same id and kind.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "kind": {
            "enum": [
              "text",
              "color",
              "media",
              "duration",
              "number",
              "enum",
              "boolean"
            ]
          },
          "spark_editable": {
            "type": "boolean"
          },
          "required": {
            "type": "boolean"
          },
          "text": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "max_chars",
              "overflow"
            ],
            "properties": {
              "max_chars": {
                "type": "integer",
                "minimum": 1,
                "maximum": 2000
              },
              "overflow": {
                "enum": [
                  "wrap",
                  "fit",
                  "reject"
                ]
              }
            }
          },
          "media": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "media_kinds"
            ],
            "properties": {
              "media_kinds": {
                "type": "array",
                "minItems": 1,
                "uniqueItems": true,
                "items": {
                  "enum": [
                    "video",
                    "image"
                  ]
                }
              },
              "aspect_ratio": {
                "type": "string",
                "pattern": "^[0-9]{1,2}:[0-9]{1,2}$"
              }
            }
          },
          "duration": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "min_frames",
              "max_frames"
            ],
            "properties": {
              "min_frames": {
                "$ref": "common.schema.json#/$defs/FrameCount"
              },
              "max_frames": {
                "$ref": "common.schema.json#/$defs/FrameCount"
              }
            }
          },
          "number": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "min",
              "max"
            ],
            "properties": {
              "min": {
                "type": "number"
              },
              "max": {
                "type": "number"
              }
            }
          },
          "enum": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "values"
            ],
            "properties": {
              "values": {
                "type": "array",
                "minItems": 1,
                "maxItems": 32,
                "uniqueItems": true,
                "items": {
                  "type": "string",
                  "maxLength": 64
                }
              }
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "enum": [
                    "number",
                    "enum",
                    "boolean"
                  ]
                }
              }
            },
            "then": {
              "properties": {
                "spark_editable": {
                  "const": false
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "text"
                }
              }
            },
            "then": {
              "required": [
                "text"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "media"
                }
              }
            },
            "then": {
              "required": [
                "media"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "duration"
                }
              }
            },
            "then": {
              "required": [
                "duration"
              ]
            }
          }
        ]
      }
    }
  },
  "production-run.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/production-run.schema.json",
    "title": "production_run_v1",
    "description": "Composition ProductionRun of one business job: the approved production operations with a durable project/target binding (URETIM \u00a74/\u00a76). It shares envelope_id with the P00-03 job (P00-10 owns amounts), carries the F21 GenerationShots of the ShotPlan's PlannedShots, their operations (P00-03 logical operation ids, P00-10 allocations, P00-09 execution pins) and the generated takes. Delete, cancel and detach are separate actions (production-rules.json).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "production_run_id",
      "project_id",
      "business_job_id",
      "envelope_id",
      "shot_plan",
      "base_working_copy_version",
      "state",
      "generation_shots",
      "operations",
      "takes",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "production_run_v1"
      },
      "production_run_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "business_job_id": {
        "description": "P00-03 job id.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "envelope_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/EnvelopeId"
      },
      "shot_plan": {
        "$ref": "common.schema.json#/$defs/PreparationArtifactRef"
      },
      "base_working_copy_version": {
        "$ref": "common.schema.json#/$defs/WorkingCopyVersion"
      },
      "state": {
        "enum": [
          "planned",
          "running",
          "partial",
          "succeeded",
          "failed",
          "canceled"
        ]
      },
      "generation_shots": {
        "type": "array",
        "maxItems": 500,
        "items": {
          "$ref": "#/$defs/GenerationShot"
        }
      },
      "operations": {
        "type": "array",
        "maxItems": 1000,
        "items": {
          "$ref": "#/$defs/Operation"
        }
      },
      "takes": {
        "type": "array",
        "maxItems": 2000,
        "items": {
          "$ref": "#/$defs/GeneratedTake"
        }
      },
      "created_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    },
    "$defs": {
      "GenerationShot": {
        "description": "F21 GenerationShot: a provider generation intent of a PlannedShot. It is not the existing Avatar catalog record (avatar.avatar_shots / AvatarShotRecord); a talking-avatar intent points at Avatar/Voice owner refs instead.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "generation_shot_id",
          "planned_shot_id",
          "ordinal",
          "capability",
          "depends_on_last_frame_of",
          "state"
        ],
        "properties": {
          "generation_shot_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "planned_shot_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "ordinal": {
            "description": "0..n provider generation intents per PlannedShot (F21; 0 intents when an asset is reused).",
            "type": "integer",
            "minimum": 0
          },
          "capability": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/ModelCatalogRef"
          },
          "requested_duration_frames": {
            "$ref": "common.schema.json#/$defs/FrameCount"
          },
          "avatar": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/AvatarRef"
          },
          "voice": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/VoiceProfileRef"
          },
          "depends_on_last_frame_of": {
            "oneOf": [
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              {
                "type": "null"
              }
            ]
          },
          "state": {
            "enum": [
              "planned",
              "valid",
              "invalidated",
              "superseded"
            ]
          }
        }
      },
      "Operation": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "operation_id",
          "kind",
          "target_binding",
          "state",
          "apply"
        ],
        "properties": {
          "operation_id": {
            "description": "P00-03 logical_operation_id.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "kind": {
            "enum": [
              "generation",
              "transform",
              "tts",
              "stt",
              "acquire",
              "motion_compile",
              "render_proxy",
              "render_final"
            ]
          },
          "generation_shot_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "target_binding": {
            "description": "Durable project/target binding; a late result is applied through composition_command_v1 with this read dependency (F27).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "target_entity_rev"
            ],
            "properties": {
              "kind": {
                "enum": [
                  "pending_slot",
                  "scene_layer",
                  "project_asset",
                  "render_manifest"
                ]
              },
              "scene_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "layer_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "manifest_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "target_entity_rev": {
                "$ref": "common.schema.json#/$defs/EntityRev"
              }
            }
          },
          "allocation_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-allocation.schema.json#/properties/allocation_id"
          },
          "execution_pin": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "logical_execution_id",
              "pin_fingerprint_hash"
            ],
            "properties": {
              "logical_execution_id": {
                "description": "P00-09 logical_execution_id (= estimate id).",
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "pin_fingerprint_hash": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/execution-pin/v1/execution-pin-package.schema.json#/properties/pin_fingerprint_hash"
              }
            }
          },
          "state": {
            "description": "Runtime state of the operation (P00-03 tool_result vocabulary); the job_status stays P00-03's.",
            "enum": [
              "queued",
              "dispatched",
              "succeeded",
              "failed",
              "canceled",
              "outcome_unknown",
              "abandoned"
            ]
          },
          "apply": {
            "description": "Result application outcome (command-rules.json); a completion is applied at most once per operation.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "outcome"
            ],
            "properties": {
              "outcome": {
                "enum": [
                  "pending",
                  "applied",
                  "rebased",
                  "conflict",
                  "orphaned",
                  "superseded",
                  "detached",
                  "invalidated"
                ]
              },
              "command_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            }
          }
        }
      },
      "GeneratedTake": {
        "description": "F21 GeneratedTake: the provider result of a GenerationShot (lineage via operation_id); becomes a ClipInstance only through a command.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "take_id",
          "generation_shot_id",
          "operation_id",
          "asset"
        ],
        "properties": {
          "take_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "generation_shot_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "operation_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "asset": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
          },
          "last_frame": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
          }
        }
      }
    }
  },
  "render-manifest.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/render-manifest.schema.json",
    "title": "render_manifest_v1",
    "description": "Immutable RenderManifest (MIMARI \u00a77, F19/F43): accurate proxy and final render come from the same exact revision, asset checksums, fonts, Brand/Motion revisions, scene compiler version and renderer pin. The live client preview is not a manifest. A final manifest never carries an unresolved anchor. A renderer re-pin creates new manifests for later renders; an existing manifest is never re-pinned. Workflow execution pins (P00-09) belong to each logical proxy/final execution, not to the manifest.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "manifest_id",
      "project_id",
      "revision_id",
      "document_sha256",
      "document_schema_version",
      "purpose",
      "seen_working_copy_version",
      "canvas",
      "renderer_pin",
      "scene_compiler_version",
      "dependencies",
      "output_profile",
      "qc_profile",
      "anchor_resolution",
      "immutable",
      "manifest_sha256",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "render_manifest_v1"
      },
      "manifest_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "revision_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "document_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "document_schema_version": {
        "type": "integer",
        "minimum": 1
      },
      "purpose": {
        "enum": [
          "accurate_proxy",
          "final"
        ]
      },
      "seen_working_copy_version": {
        "$ref": "common.schema.json#/$defs/SeenWorkingCopyVersion"
      },
      "canvas": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "aspect_ratio",
          "width",
          "height",
          "fps"
        ],
        "properties": {
          "aspect_ratio": {
            "enum": [
              "16:9",
              "9:16",
              "1:1"
            ]
          },
          "width": {
            "type": "integer",
            "minimum": 16
          },
          "height": {
            "type": "integer",
            "minimum": 16
          },
          "fps": {
            "$ref": "common.schema.json#/$defs/Rational"
          }
        }
      },
      "renderer_pin": {
        "$ref": "common.schema.json#/$defs/RendererPin"
      },
      "scene_compiler_version": {
        "description": "scene_compiler@N pinned (SAHNE \u00a74).",
        "type": "integer",
        "minimum": 1
      },
      "dependencies": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "assets",
          "fonts",
          "brand",
          "motion"
        ],
        "properties": {
          "assets": {
            "type": "array",
            "maxItems": 2000,
            "items": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
            }
          },
          "fonts": {
            "type": "array",
            "maxItems": 64,
            "items": {
              "$ref": "common.schema.json#/$defs/FontRef"
            }
          },
          "brand": {
            "type": "array",
            "maxItems": 64,
            "items": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
            }
          },
          "audio_licenses": {
            "description": "P06-09 (F48): optional (present only when the audio licence owner is enabled and the document has music/sfx placements). One binding per music/sfx audio dependency, sorted by storage_object_id then source_id; narration is not listed (the Voice owner gates it). A final manifest lists only bound licences whose allowed uses include project use and final distribution.",
            "type": "array",
            "maxItems": 200,
            "items": {
              "$ref": "common.schema.json#/$defs/AudioLicenseBinding"
            }
          },
          "motion": {
            "type": "array",
            "maxItems": 256,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "motion",
                "parameter_snapshot_sha256"
              ],
              "properties": {
                "motion": {
                  "$ref": "common.schema.json#/$defs/MotionRevisionRef"
                },
                "parameter_snapshot_sha256": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
                }
              }
            }
          }
        }
      },
      "output_profile": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "profile_id",
          "profile_revision"
        ],
        "properties": {
          "profile_id": {
            "description": "e.g. spark-export-v1 (F44).",
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9.-]{1,63}$"
          },
          "profile_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "qc_profile": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "profile_id",
          "profile_revision"
        ],
        "properties": {
          "profile_id": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9.-]{1,63}$"
          },
          "profile_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "anchor_resolution": {
        "description": "Anchor resolution report written by the compiler (SAHNE \u00a73).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "report_sha256",
          "unresolved_count"
        ],
        "properties": {
          "report_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "unresolved_count": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "immutable": {
        "const": true
      },
      "manifest_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "created_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "purpose": {
              "const": "final"
            }
          }
        },
        "then": {
          "properties": {
            "anchor_resolution": {
              "properties": {
                "unresolved_count": {
                  "const": 0
                }
              }
            },
            "dependencies": {
              "properties": {
                "audio_licenses": {
                  "items": {
                    "properties": {
                      "status": {
                        "const": "bound"
                      },
                      "allowed_uses": {
                        "allOf": [
                          {
                            "contains": {
                              "const": "project_use"
                            }
                          },
                          {
                            "contains": {
                              "const": "final_distribution"
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  },
  "renderer-repin.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/renderer-repin.schema.json",
    "title": "renderer_repin_v1",
    "description": "Renderer re-pin migration record of one project (F43, K256). A renderer revision is retired only after every project pinning it has an applied re-pin with a passed parity report under the shared QC profile. Re-pin changes the project's renderer_pin for later manifests; existing manifests keep their pin.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "repin_id",
      "project_id",
      "revision_id",
      "from_renderer_pin",
      "to_renderer_pin",
      "parity_report",
      "status",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "renderer_repin_v1"
      },
      "repin_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "revision_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "from_renderer_pin": {
        "$ref": "common.schema.json#/$defs/RendererPin"
      },
      "to_renderer_pin": {
        "$ref": "common.schema.json#/$defs/RendererPin"
      },
      "parity_report": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "report_id",
          "qc_profile_revision",
          "result",
          "report_sha256"
        ],
        "properties": {
          "report_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "qc_profile_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "result": {
            "enum": [
              "passed",
              "failed"
            ]
          },
          "report_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "status": {
        "enum": [
          "planned",
          "parity_failed",
          "applied"
        ]
      },
      "created_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "status": {
              "const": "applied"
            }
          }
        },
        "then": {
          "properties": {
            "parity_report": {
              "properties": {
                "result": {
                  "const": "passed"
                }
              }
            }
          }
        }
      }
    ]
  },
  "undo-group.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/undo-group.schema.json",
    "title": "composition_undo_group_v1",
    "description": "Server-side undo group of one actor in one project (F28): persistent across reload and device change, the last 100 groups per actor (config). Undo is a CAS'd inverse command over entity_revs_after; if another actor changed a target, undo returns a conflict and another actor's command is never undone. An AI apply is one group. TK-32: actor_user_id + origin; placeholders never enter a group.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "undo_group_id",
      "project_id",
      "actor_user_id",
      "origin",
      "command_ids",
      "entity_revs_after",
      "inverse_ops",
      "state",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "composition_undo_group_v1"
      },
      "undo_group_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "actor_user_id": {
        "$ref": "common.schema.json#/$defs/ActorUserId"
      },
      "origin": {
        "$ref": "common.schema.json#/$defs/Origin"
      },
      "command_ids": {
        "type": "array",
        "minItems": 1,
        "maxItems": 100,
        "uniqueItems": true,
        "items": {
          "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
        }
      },
      "entity_revs_after": {
        "type": "array",
        "minItems": 1,
        "maxItems": 400,
        "items": {
          "allOf": [
            {
              "$ref": "common.schema.json#/$defs/EntityRevRef"
            },
            {
              "properties": {
                "entity_kind": {
                  "not": {
                    "const": "pending_slot"
                  }
                }
              }
            }
          ]
        }
      },
      "inverse_ops": {
        "type": "array",
        "minItems": 1,
        "maxItems": 400,
        "items": {
          "description": "P00-13 motion-spark edit_op_v1 inverse operations (typed inverse command).",
          "type": "object",
          "required": [
            "op"
          ],
          "properties": {
            "op": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
            }
          }
        }
      },
      "state": {
        "enum": [
          "applied",
          "undone",
          "conflicted",
          "evicted"
        ]
      },
      "created_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
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
  "assistant-runtime/v1/owner-refs.schema.json": {
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
  "execution-pin/v1/execution-pin-package.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/execution-pin/v1/execution-pin-package.schema.json",
    "title": "Execution pin package (P00-09)",
    "description": "Server-owned, immutable pin package that estimate -> G1 approval fingerprint -> launch -> recovery carry unchanged for one logical execution. Reuses workflow-engine/app/node_impl.py:NodeImplPin and api-gateway/src/workflow/domain/types/workflow-node-versioning.types.ts:WorkflowNodeImplPin field-for-field; adds no new per-node field.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "node_impl_pins",
      "execution_dsl_hash",
      "pin_fingerprint_hash",
      "pinned_at",
      "source_estimate_ref"
    ],
    "properties": {
      "schema_version": {
        "const": "1"
      },
      "node_impl_pins": {
        "description": "Keyed by opaque DSL node_key, same shape as resolve_impl_pins()'s return value (workflow-engine/app/node_impl.py:92-111) and WorkflowNodeImplPins (workflow-node-versioning.types.ts:3-14).",
        "type": "object",
        "minProperties": 1,
        "additionalProperties": {
          "$ref": "#/$defs/node_impl_pin"
        }
      },
      "execution_dsl_hash": {
        "description": "Same value as WorkflowEstimateDTO.execution_dsl_hash (i-workflow-estimate.repository.port.ts:30): the Gateway stableJsonHash / implPinning.fingerprint() output (workflow-hash.service.ts:9-14, workflow-node-impl-pinning.service.ts:59-66), i.e. lowercase sha256 hex without prefix.",
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "pin_fingerprint_hash": {
        "description": "stableJsonHash({execution_dsl_hash, node_impl_pins}) exactly as the Gateway computes it (workflow-hash.service.ts stableStringify: sorted keys, compact, no ASCII escaping; sha256 lowercase hex WITHOUT prefix). Python twin: json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False). A TypeScript-computed golden vector pins the byte equality (pin-rules.json fingerprint.golden_vectors). It is a new, separate field: the retry audit value node_impl_pins_hash (retry-workflow.use-case.ts:104-106) hashes node_impl_pins only and stays as it is. MUST NOT depend on mcp_metadata_revision or any stage-record field.",
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "pinned_at": {
        "description": "When this package was produced (estimate creation time; unchanged by later stages that merely carry it).",
        "type": "string",
        "format": "date-time"
      },
      "source_estimate_ref": {
        "description": "Typed pointer to the owning estimate row (WorkflowEstimateDTO.id/tenant_id, i-workflow-estimate.repository.port.ts:32-33). Not a $ref across packages; P00-03 owns the job/run fields that this estimate is attached to.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "tenant_id",
          "estimate_id"
        ],
        "properties": {
          "tenant_id": {
            "type": "string",
            "minLength": 1
          },
          "estimate_id": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "$defs": {
      "node_impl_pin": {
        "description": "Field-for-field mirror of NodeImplPin (workflow-engine/app/node_impl.py:16-26) and WorkflowNodeImplPin (workflow-node-versioning.types.ts:3-14).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "impl_revision",
          "schema_hash",
          "contract_hash",
          "pricing_hash"
        ],
        "properties": {
          "type": {
            "description": "node_type@version, e.g. video_generate@2.",
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*)*@\\d+$"
          },
          "impl_revision": {
            "type": "integer",
            "minimum": 1
          },
          "schema_hash": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "contract_hash": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "pricing_hash": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "image_digest": {
            "type": "string",
            "pattern": "^sha256:[a-f0-9]{64}$"
          },
          "task_queue": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
          },
          "recipe_revision": {
            "type": "integer",
            "minimum": 1
          },
          "child_node_keys": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "if": {
          "properties": {
            "task_queue": {
              "type": "string"
            }
          },
          "required": [
            "task_queue"
          ]
        },
        "then": {
          "required": [
            "image_digest"
          ]
        }
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
  },
  "scope-grants/v1/project-asset-grant.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/project-asset-grant.schema.json",
    "title": "project_asset_grant_v1",
    "description": "A deliberate, authorized import of an asset into a Composition project creates this project grant plus a persistent Storage project reference (KESIN PR04, MIMARI \u00a75 'Kal\u0131c\u0131 proje'). Project members read/use the asset through it; it never grants access to the source conversation or Memory. Deleting the source conversation does not change it. Removing from the project, revoking the grant and deleting the asset everywhere are separate operations (scope-rules.json project_asset_operations). A persistent reference is not a temporary worker lease. attach_idempotency_key (K67): a retried import of the same (project, asset) with the same key resolves to this same grant, never a duplicate binding. binding_generation (K67): bumped by every status change; project_asset_operations act only on the exact grant_id + expected binding_generation they were given, so a stale/old compensation can never release a newer binding.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "grant_id",
      "tenant_id",
      "project",
      "asset",
      "attach_idempotency_key",
      "binding_generation",
      "storage_reference",
      "provenance",
      "imported_by_user_id",
      "audience",
      "permissions",
      "status",
      "created_at",
      "status_changed_at"
    ],
    "properties": {
      "schema_version": {
        "const": "project_asset_grant_v1"
      },
      "grant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "project": {
        "$ref": "#/$defs/ProjectRef"
      },
      "attach_idempotency_key": {
        "description": "Caller-supplied key for one logical (project, asset) attach attempt; a retry with the same key on the same pair replays this grant instead of creating a second active binding.",
        "type": "string",
        "minLength": 8,
        "maxLength": 128
      },
      "binding_generation": {
        "description": "CAS counter for this binding; project_asset_operations require the caller's expected_binding_generation to match before changing status.",
        "$ref": "common.schema.json#/$defs/Generation"
      },
      "asset": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "owner_bc": {
            "const": "storage"
          },
          "storage_object_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "checksum_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "storage_reference": {
        "$ref": "#/$defs/StorageReference"
      },
      "provenance": {
        "description": "Where the asset came from. Provenance only: later project reads/renders never depend on the source existing.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source_kind",
          "conversation_id",
          "message_id"
        ],
        "properties": {
          "source_kind": {
            "enum": [
              "conversation_artifact",
              "upload",
              "stock",
              "connector_import",
              "generation"
            ]
          },
          "conversation_id": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              {
                "type": "null"
              }
            ]
          },
          "message_id": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "imported_by_user_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "audience": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "const": "project_members"
          },
          "id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "permissions": {
        "type": "array",
        "minItems": 1,
        "maxItems": 2,
        "uniqueItems": true,
        "items": {
          "enum": [
            "read",
            "use_in_context"
          ]
        }
      },
      "status": {
        "enum": [
          "active",
          "removed_from_project",
          "revoked",
          "asset_deleted"
        ]
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "status_changed_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "provenance": {
              "properties": {
                "source_kind": {
                  "const": "conversation_artifact"
                }
              }
            }
          }
        },
        "then": {
          "properties": {
            "provenance": {
              "properties": {
                "conversation_id": {
                  "$ref": "common.schema.json#/$defs/OpaqueId"
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "ProjectRef": {
        "description": "Composition project (Spark project entry, PR #294: private, tenant + owner scoped, id cprj_<uuid>).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "project_id",
          "channel_id"
        ],
        "properties": {
          "owner_bc": {
            "const": "composition"
          },
          "project_id": {
            "type": "string",
            "pattern": "^cprj_[0-9a-f-]{36}$"
          },
          "channel_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "StorageReference": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "reference_id",
          "kind",
          "created_at",
          "released_at"
        ],
        "properties": {
          "reference_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "kind": {
            "const": "persistent_project_reference"
          },
          "created_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "released_at": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Timestamp"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      }
    }
  },
  "spend-envelope/v1/spend-allocation.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-allocation.schema.json",
    "title": "spend_allocation_v1",
    "description": "One atomic allocation of an envelope's ceiling to one attempt of one logical operation. The single charge owner (Assistant Chat reservation/settlement or Workflow node allocation/settlement) executes and settles it; its receipt is bound to this allocation exactly once. A new attempt gets a new allocation. Credit numbers must be compared as decimals.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "allocation_id",
      "envelope_id",
      "tenant_id",
      "logical_operation_id",
      "attempt",
      "idempotency_key",
      "charge_owner",
      "funding_channel",
      "principal_id",
      "quota_eligible",
      "authorization_phase",
      "approval_version",
      "effective_mode",
      "sub_job_ref",
      "allocated_credits",
      "quota_consumption",
      "status",
      "settled_credits",
      "overrun_credits",
      "release_evidence",
      "abandon",
      "receipt_binding",
      "created_at",
      "updated_at",
      "record_version"
    ],
    "properties": {
      "schema_version": {
        "const": 1
      },
      "allocation_id": {
        "type": "string",
        "pattern": "^alc_[A-Za-z0-9_-]{3,64}$"
      },
      "envelope_id": {
        "type": "string",
        "pattern": "^env_[A-Za-z0-9_-]{3,64}$"
      },
      "tenant_id": {
        "$ref": "#/$defs/OpaqueId"
      },
      "logical_operation_id": {
        "$ref": "#/$defs/OpaqueId"
      },
      "attempt": {
        "type": "integer",
        "minimum": 1,
        "maximum": 1000
      },
      "idempotency_key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 256
      },
      "charge_owner": {
        "description": "The only execution charge owner for this allocation (URETIM 2B).",
        "enum": [
          "assistant",
          "workflow"
        ]
      },
      "funding_channel": {
        "enum": [
          "app",
          "api",
          "mcp"
        ]
      },
      "principal_id": {
        "$ref": "#/$defs/OpaqueId"
      },
      "quota_eligible": {
        "type": "boolean"
      },
      "authorization_phase": {
        "description": "Envelope phase the allocation was taken from (TK-17: sub-jobs use the parent's current phase).",
        "enum": [
          "preparation",
          "production",
          "session"
        ]
      },
      "approval_version": {
        "description": "Envelope approval_version when the allocation was granted; 0 only for quota-only allocations taken before any credit grant.",
        "type": "integer",
        "minimum": 0
      },
      "effective_mode": {
        "description": "P00-11 effective mode of the job at this dispatch (D04: a mode_snapshot grant derived under a higher mode waits for a new decision). null for schedule/triggered and API/MCP runs.",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "enum": [
              "ask",
              "auto",
              "auto_full"
            ]
          }
        ]
      },
      "sub_job_ref": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "sub_job_id",
              "parent_business_job_id"
            ],
            "properties": {
              "sub_job_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "parent_business_job_id": {
                "$ref": "#/$defs/OpaqueId"
              }
            }
          }
        ]
      },
      "allocated_credits": {
        "$ref": "#/$defs/Credits"
      },
      "quota_consumption": {
        "description": "Plan quota consumed alongside (or instead of) credits; only for quota-eligible app allocations (TK-15, Q82 split).",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "quota_key",
              "units"
            ],
            "properties": {
              "quota_key": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_:.-]{1,127}$"
              },
              "units": {
                "type": "number",
                "exclusiveMinimum": 0
              }
            }
          }
        ]
      },
      "status": {
        "enum": [
          "authorized",
          "dispatched",
          "outcome_unknown",
          "settled",
          "abandoned",
          "released"
        ]
      },
      "settled_credits": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Credits"
          }
        ]
      },
      "overrun_credits": {
        "description": "Actual cost above the allocation that could not be covered by remaining_allocatable; never charged, raises admin_review.",
        "$ref": "#/$defs/Credits"
      },
      "release_evidence": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "enum": [
              "provider_not_dispatched",
              "known_no_charge",
              "refund_completed"
            ]
          }
        ]
      },
      "abandon": {
        "description": "TK-16 class: a flow we cut on purpose is not outcome_unknown.",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "reason",
              "usage_reported"
            ],
            "properties": {
              "reason": {
                "enum": [
                  "user_cancel",
                  "lane_b_cancel",
                  "context_limit_summarize",
                  "supplier_switch"
                ]
              },
              "usage_reported": {
                "type": "boolean"
              }
            }
          }
        ]
      },
      "receipt_binding": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "receipt_kind",
              "receipt_id",
              "bound_at"
            ],
            "properties": {
              "receipt_kind": {
                "enum": [
                  "chat_usage_settlement",
                  "workflow_node_allocation"
                ]
              },
              "receipt_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "bound_at": {
                "$ref": "#/$defs/Timestamp"
              }
            }
          }
        ]
      },
      "created_at": {
        "$ref": "#/$defs/Timestamp"
      },
      "updated_at": {
        "$ref": "#/$defs/Timestamp"
      },
      "record_version": {
        "type": "integer",
        "minimum": 1
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "funding_channel": {
              "const": "app"
            }
          },
          "required": [
            "funding_channel"
          ]
        },
        "then": {
          "properties": {
            "quota_eligible": {
              "const": true
            }
          }
        },
        "else": {
          "properties": {
            "quota_eligible": {
              "const": false
            },
            "quota_consumption": {
              "type": "null"
            },
            "effective_mode": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "quota_consumption": {
              "type": "object"
            }
          },
          "required": [
            "quota_consumption"
          ]
        },
        "then": {
          "properties": {
            "quota_eligible": {
              "const": true
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "enum": [
                "authorized",
                "dispatched",
                "outcome_unknown"
              ]
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "settled_credits": {
              "type": "null"
            },
            "overrun_credits": {
              "maximum": 0
            },
            "release_evidence": {
              "type": "null"
            },
            "abandon": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "authorized"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "receipt_binding": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "settled"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "settled_credits": {
              "$ref": "#/$defs/Credits"
            },
            "release_evidence": {
              "type": "null"
            },
            "abandon": {
              "type": "null"
            },
            "receipt_binding": {
              "type": "object"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "abandoned"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "settled_credits": {
              "$ref": "#/$defs/Credits"
            },
            "release_evidence": {
              "type": "null"
            },
            "abandon": {
              "type": "object"
            },
            "receipt_binding": {
              "type": "object"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "released"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "settled_credits": {
              "$ref": "#/$defs/Credits",
              "maximum": 0
            },
            "overrun_credits": {
              "maximum": 0
            },
            "release_evidence": {
              "type": "string"
            },
            "abandon": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "charge_owner": {
              "const": "assistant"
            }
          },
          "required": [
            "charge_owner"
          ]
        },
        "then": {
          "properties": {
            "receipt_binding": {
              "properties": {
                "receipt_kind": {
                  "const": "chat_usage_settlement"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "charge_owner": {
              "const": "workflow"
            }
          },
          "required": [
            "charge_owner"
          ]
        },
        "then": {
          "properties": {
            "receipt_binding": {
              "properties": {
                "receipt_kind": {
                  "const": "workflow_node_allocation"
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Credits": {
        "description": "Credit amount on the existing Billing CreditAmount boundary (0.0001).",
        "type": "number",
        "minimum": 0,
        "maximum": 900719925474.0991,
        "multipleOf": 0.0001
      }
    }
  },
  "spend-envelope/v1/spend-envelope.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json",
    "title": "spend_envelope_v1",
    "description": "Billing-owned spend authorization envelope. One envelope per Assistant business job (shared with its Composition ProductionRun) or per Spark quick-AI edit session. It is the atomic ceiling and allocation authority, not a second monetary ledger: Chat reservation/settlement and Workflow parent/node settlement remain the only charge owners. Invariant (checked outside JSON Schema, see envelope-rules.json): spent + outstanding_authorized_allocations <= approved_max_credits. Credit numbers must be compared as decimals.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "envelope_id",
      "tenant_id",
      "envelope_kind",
      "subject",
      "funding_channel",
      "principal_id",
      "principal_kind",
      "quota_eligible",
      "launch_origin",
      "status",
      "authorization_phase",
      "approval_version",
      "approved_max_credits",
      "spent",
      "outstanding_authorized_allocations",
      "outcome_unknown",
      "remaining_allocatable",
      "wallet_held",
      "funding_buffer",
      "authorization",
      "authorization_history",
      "pending_approval_request",
      "created_at",
      "updated_at",
      "record_version"
    ],
    "properties": {
      "schema_version": {
        "const": 1
      },
      "envelope_id": {
        "$ref": "#/$defs/EnvelopeId"
      },
      "tenant_id": {
        "$ref": "#/$defs/OpaqueId"
      },
      "envelope_kind": {
        "description": "job: Assistant business job + its ProductionRun (Chat, Spark, Tools, render_only export, scheduled, API/MCP). edit_session: Spark quick-AI edit session (TK-14).",
        "enum": [
          "job",
          "edit_session"
        ]
      },
      "subject": {
        "oneOf": [
          {
            "$ref": "#/$defs/JobSubject"
          },
          {
            "$ref": "#/$defs/EditSessionSubject"
          }
        ]
      },
      "funding_channel": {
        "$ref": "#/$defs/FundingChannel"
      },
      "principal_id": {
        "description": "Paying principal (TK-15). app: the initiating user actor (F41); api/mcp: the external principal (DEVELOPER-PLATFORM 6.1).",
        "$ref": "#/$defs/OpaqueId"
      },
      "principal_kind": {
        "enum": [
          "user",
          "personal_key",
          "developer_app",
          "mcp_client"
        ]
      },
      "quota_eligible": {
        "description": "Plan quotas (included render minutes, quick-AI units, free entitlements) may be consumed only when true; true exactly for funding_channel app (TK-15, Q65).",
        "type": "boolean"
      },
      "launch_origin": {
        "description": "user_session: interactive app use. schedule/triggered: Q79 scheduled or event-triggered runs (for example a connector webhook), authorized by scheduled_bypass. external_principal: API/MCP.",
        "enum": [
          "user_session",
          "schedule",
          "triggered",
          "external_principal"
        ]
      },
      "status": {
        "enum": [
          "open",
          "draining",
          "closed"
        ]
      },
      "authorization_phase": {
        "$ref": "#/$defs/AuthorizationPhase"
      },
      "approval_version": {
        "description": "Version of the current ceiling; 0 until the first grant. Every ceiling change adds exactly one.",
        "type": "integer",
        "minimum": 0
      },
      "approved_max_credits": {
        "$ref": "#/$defs/Credits"
      },
      "spent": {
        "$ref": "#/$defs/Credits"
      },
      "outstanding_authorized_allocations": {
        "description": "Allocated but not yet settled or released; includes accepted and outcome_unknown obligations.",
        "$ref": "#/$defs/Credits"
      },
      "outcome_unknown": {
        "description": "Subset of outstanding_authorized_allocations whose provider outcome is unknown; never summed twice and never re-allocated before it is resolved.",
        "$ref": "#/$defs/Credits"
      },
      "remaining_allocatable": {
        "$ref": "#/$defs/Credits"
      },
      "wallet_held": {
        "description": "Real blocked wallet balance for this job. Display/funding projection only; not spend authority.",
        "$ref": "#/$defs/Credits"
      },
      "funding_buffer": {
        "description": "Workflow parent 10% buffer and planner reserve safety margin currently held. Display/funding projection only; not spend authority (B01, K90).",
        "$ref": "#/$defs/Credits"
      },
      "authorization": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Authorization"
          }
        ]
      },
      "authorization_history": {
        "description": "Earlier authorizations of this same envelope, approval_version 1..n-1 in order (G1 widening keeps the envelope_id).",
        "type": "array",
        "maxItems": 64,
        "items": {
          "$ref": "#/$defs/Authorization"
        }
      },
      "pending_approval_request": {
        "description": "The open ask_once, if any (Q73): an approval must carry this decision_id and requested_max_credits. Superseded by a later start/no_change/funding_required decision (envelope-rules.json pending_approval_rules).",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/PendingApprovalRequest"
          }
        ]
      },
      "created_at": {
        "$ref": "#/$defs/Timestamp"
      },
      "updated_at": {
        "$ref": "#/$defs/Timestamp"
      },
      "record_version": {
        "description": "Row CAS version of the envelope record.",
        "type": "integer",
        "minimum": 1
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "funding_channel": {
              "const": "app"
            }
          },
          "required": [
            "funding_channel"
          ]
        },
        "then": {
          "properties": {
            "principal_kind": {
              "const": "user"
            },
            "quota_eligible": {
              "const": true
            },
            "launch_origin": {
              "enum": [
                "user_session",
                "schedule",
                "triggered"
              ]
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "funding_channel": {
              "const": "api"
            }
          },
          "required": [
            "funding_channel"
          ]
        },
        "then": {
          "properties": {
            "principal_kind": {
              "enum": [
                "personal_key",
                "developer_app"
              ]
            },
            "quota_eligible": {
              "const": false
            },
            "launch_origin": {
              "const": "external_principal"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "funding_channel": {
              "const": "mcp"
            }
          },
          "required": [
            "funding_channel"
          ]
        },
        "then": {
          "properties": {
            "principal_kind": {
              "const": "mcp_client"
            },
            "quota_eligible": {
              "const": false
            },
            "launch_origin": {
              "const": "external_principal"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "envelope_kind": {
              "const": "edit_session"
            }
          },
          "required": [
            "envelope_kind"
          ]
        },
        "then": {
          "properties": {
            "funding_channel": {
              "const": "app"
            },
            "launch_origin": {
              "const": "user_session"
            },
            "authorization_phase": {
              "const": "session"
            },
            "subject": {
              "$ref": "#/$defs/EditSessionSubject"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "envelope_kind": {
              "const": "job"
            }
          },
          "required": [
            "envelope_kind"
          ]
        },
        "then": {
          "properties": {
            "authorization_phase": {
              "enum": [
                "preparation",
                "production"
              ]
            },
            "subject": {
              "$ref": "#/$defs/JobSubject"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "authorization": {
              "type": "null"
            }
          },
          "required": [
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "approved_max_credits": {
              "maximum": 0
            },
            "approval_version": {
              "const": 0
            },
            "authorization_history": {
              "maxItems": 0
            },
            "authorization_phase": {
              "enum": [
                "preparation",
                "session"
              ]
            }
          }
        },
        "else": {
          "properties": {
            "approval_version": {
              "minimum": 1
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "funding_channel": {
              "enum": [
                "api",
                "mcp"
              ]
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "funding_channel",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "const": "principal_bypass"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "launch_origin": {
              "enum": [
                "schedule",
                "triggered"
              ]
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "launch_origin",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "const": "scheduled_bypass"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "launch_origin": {
              "const": "user_session"
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "launch_origin",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "enum": [
                    "preparation_grant",
                    "mode_snapshot",
                    "user_approval"
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
            "authorization_phase": {
              "const": "preparation"
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "authorization_phase",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "const": "preparation_grant"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "authorization_phase": {
              "const": "production"
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "authorization_phase",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "enum": [
                    "mode_snapshot",
                    "user_approval",
                    "scheduled_bypass",
                    "principal_bypass"
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
            "authorization_phase": {
              "const": "session"
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "authorization_phase",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "enum": [
                    "mode_snapshot",
                    "user_approval"
                  ]
                },
                "estimate": {
                  "properties": {
                    "source": {
                      "const": "edit_session_policy_cap"
                    }
                  }
                }
              }
            },
            "authorization_history": {
              "items": {
                "properties": {
                  "estimate": {
                    "properties": {
                      "source": {
                        "const": "edit_session_policy_cap"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "else": {
          "properties": {
            "authorization": {
              "properties": {
                "estimate": {
                  "properties": {
                    "source": {
                      "const": "server_cold_max_output"
                    }
                  }
                }
              }
            },
            "authorization_history": {
              "items": {
                "properties": {
                  "estimate": {
                    "properties": {
                      "source": {
                        "const": "server_cold_max_output"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "EnvelopeId": {
        "type": "string",
        "pattern": "^env_[A-Za-z0-9_-]{3,64}$"
      },
      "CompositionProjectId": {
        "description": "Composition project id (Spark project entry, PR #294: private, tenant + owner scoped).",
        "type": "string",
        "pattern": "^cprj_[0-9a-f-]{36}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Credits": {
        "description": "Credit amount on the existing Billing CreditAmount boundary: non-negative, 4 decimal places (0.0001), within the Workflow safe four-decimal range.",
        "type": "number",
        "minimum": 0,
        "maximum": 900719925474.0991,
        "multipleOf": 0.0001
      },
      "FundingChannel": {
        "description": "app = Chat/Spark/Tools/scheduled, api, mcp (TK-15).",
        "enum": [
          "app",
          "api",
          "mcp"
        ]
      },
      "AuthorizationPhase": {
        "description": "preparation: before G1, bounded preparation grant (F31). production: after G1 (or bypass admission). session: edit_session envelope.",
        "enum": [
          "preparation",
          "production",
          "session"
        ]
      },
      "Mode": {
        "description": "Canonical mode (F24/Q74); the mode table itself is owned by P00-13.",
        "enum": [
          "ask",
          "auto",
          "auto_full"
        ]
      },
      "JobSubject": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "business_job_id",
          "production_run_id",
          "project_id"
        ],
        "properties": {
          "business_job_id": {
            "$ref": "#/$defs/OpaqueId"
          },
          "production_run_id": {
            "description": "Composition ProductionRun bound to this same envelope; null until it exists.",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/OpaqueId"
              }
            ]
          },
          "project_id": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/CompositionProjectId"
              }
            ]
          }
        }
      },
      "EditSessionSubject": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "edit_session_id",
          "project_id"
        ],
        "properties": {
          "edit_session_id": {
            "$ref": "#/$defs/OpaqueId"
          },
          "project_id": {
            "$ref": "#/$defs/CompositionProjectId"
          }
        }
      },
      "ModeSnapshot": {
        "description": "Mode in force when the grant was derived or approved (audit: 'derived from mode snapshot', Q70).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "mode",
          "settings_ref"
        ],
        "properties": {
          "mode": {
            "$ref": "#/$defs/Mode"
          },
          "settings_ref": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "version"
            ],
            "properties": {
              "kind": {
                "description": "job_settings for jobs, conversation_defaults for edit sessions (versions owned by P00-11).",
                "enum": [
                  "job_settings",
                  "conversation_defaults"
                ]
              },
              "version": {
                "type": "integer",
                "minimum": 1
              }
            }
          }
        }
      },
      "EstimateRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "estimate_revision",
          "total_upper_bound_credits",
          "source"
        ],
        "properties": {
          "estimate_revision": {
            "$ref": "#/$defs/OpaqueId"
          },
          "total_upper_bound_credits": {
            "description": "Server cold/max-output/allowed retry/repair/proxy/render total for the job, including credits already spent (B01). The LLM never supplies this number.",
            "$ref": "#/$defs/Credits"
          },
          "source": {
            "description": "server_cold_max_output for jobs; edit_session_policy_cap for edit sessions (per-plan Feature Control spark_quick_ai_session_max_credits; coordinator decision 26 Sep 2026, value is config).",
            "enum": [
              "server_cold_max_output",
              "edit_session_policy_cap"
            ]
          }
        }
      },
      "PreparationCap": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source",
          "subscription_plan_revision",
          "cap_credits"
        ],
        "properties": {
          "source": {
            "const": "feature_control_plan_and_user_policy"
          },
          "subscription_plan_revision": {
            "$ref": "#/$defs/OpaqueId"
          },
          "cap_credits": {
            "$ref": "#/$defs/Credits"
          }
        }
      },
      "PendingApprovalRequest": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "decision_id",
          "requested_max_credits",
          "trigger",
          "asked_in_mode"
        ],
        "properties": {
          "decision_id": {
            "description": "Review request id the approval must answer.",
            "$ref": "#/$defs/OpaqueId"
          },
          "requested_max_credits": {
            "$ref": "#/$defs/Credits"
          },
          "trigger": {
            "enum": [
              "g1",
              "reestimate",
              "edit_session_charge"
            ]
          },
          "asked_in_mode": {
            "description": "Mode the question was asked in; user_approval.mode_snapshot records it. auto_full never asks.",
            "enum": [
              "ask",
              "auto"
            ]
          }
        }
      },
      "DecisionRef": {
        "description": "Canonical Review request decision that approved the amount (F17).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "decision_id",
          "decision_version"
        ],
        "properties": {
          "decision_id": {
            "$ref": "#/$defs/OpaqueId"
          },
          "decision_version": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "Authorization": {
        "description": "One versioned ceiling grant. basis is the audit reason: preparation_grant (bounded pre-G1 grant from Feature Control + user policy), mode_snapshot (auto/auto_full derived, no question, Q70), user_approval (Ask, or auto at/above 75%, or Q73 re-ask), scheduled_bypass (Q79), principal_bypass (API/MCP, Q74).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "approval_version",
          "basis",
          "approved_max_credits",
          "mode_snapshot",
          "estimate",
          "preparation_cap",
          "principal_job_cap_credits",
          "decision_ref",
          "granted_at"
        ],
        "properties": {
          "approval_version": {
            "type": "integer",
            "minimum": 1
          },
          "basis": {
            "enum": [
              "preparation_grant",
              "mode_snapshot",
              "user_approval",
              "scheduled_bypass",
              "principal_bypass"
            ]
          },
          "approved_max_credits": {
            "$ref": "#/$defs/Credits"
          },
          "mode_snapshot": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/ModeSnapshot"
              }
            ]
          },
          "estimate": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/EstimateRef"
              }
            ]
          },
          "preparation_cap": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/PreparationCap"
              }
            ]
          },
          "principal_job_cap_credits": {
            "description": "Principal per-job cap in force (values owned by DEV-12); only for principal_bypass.",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/Credits"
              }
            ]
          },
          "decision_ref": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/DecisionRef"
              }
            ]
          },
          "granted_at": {
            "$ref": "#/$defs/Timestamp"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "preparation_grant"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "$ref": "#/$defs/ModeSnapshot"
                },
                "estimate": {
                  "type": "null"
                },
                "preparation_cap": {
                  "$ref": "#/$defs/PreparationCap"
                },
                "principal_job_cap_credits": {
                  "type": "null"
                },
                "decision_ref": {
                  "type": "null"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "mode_snapshot"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "allOf": [
                    {
                      "$ref": "#/$defs/ModeSnapshot"
                    },
                    {
                      "properties": {
                        "mode": {
                          "enum": [
                            "auto",
                            "auto_full"
                          ]
                        }
                      }
                    }
                  ]
                },
                "estimate": {
                  "$ref": "#/$defs/EstimateRef"
                },
                "preparation_cap": {
                  "type": "null"
                },
                "principal_job_cap_credits": {
                  "type": "null"
                },
                "decision_ref": {
                  "type": "null"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "user_approval"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "allOf": [
                    {
                      "$ref": "#/$defs/ModeSnapshot"
                    },
                    {
                      "properties": {
                        "mode": {
                          "enum": [
                            "ask",
                            "auto"
                          ]
                        }
                      }
                    }
                  ]
                },
                "estimate": {
                  "$ref": "#/$defs/EstimateRef"
                },
                "preparation_cap": {
                  "type": "null"
                },
                "principal_job_cap_credits": {
                  "type": "null"
                },
                "decision_ref": {
                  "$ref": "#/$defs/DecisionRef"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "scheduled_bypass"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "type": "null"
                },
                "estimate": {
                  "$ref": "#/$defs/EstimateRef"
                },
                "preparation_cap": {
                  "type": "null"
                },
                "principal_job_cap_credits": {
                  "type": "null"
                },
                "decision_ref": {
                  "type": "null"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "principal_bypass"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "type": "null"
                },
                "estimate": {
                  "$ref": "#/$defs/EstimateRef"
                },
                "preparation_cap": {
                  "type": "null"
                },
                "principal_job_cap_credits": {
                  "$ref": "#/$defs/Credits"
                },
                "decision_ref": {
                  "type": "null"
                }
              }
            }
          }
        ]
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["composition-command", "composition-document", "composition-project", "composition-revision", "motion-exposure", "production-run", "render-manifest", "renderer-repin", "undo-group"] as const;
export type DocumentType = "composition-command" | "composition-document" | "composition-project" | "composition-revision" | "motion-exposure" | "production-run" | "render-manifest" | "renderer-repin" | "undo-group";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "composition-command": [
    "composition_command_v1"
  ],
  "composition-document": [
    1
  ],
  "composition-revision": [
    "composition_revision_v1"
  ],
  "motion-exposure": [
    "motion_exposure_v1"
  ],
  "production-run": [
    "production_run_v1"
  ],
  "render-manifest": [
    "render_manifest_v1"
  ],
  "renderer-repin": [
    "renderer_repin_v1"
  ],
  "undo-group": [
    "composition_undo_group_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "renderer-repin": {
    "status": [
      "applied",
      "parity_failed",
      "planned"
    ]
  }
};

export type CompositionCommand = {
    readonly "schema_version": "composition_command_v1";
    readonly "command_id": unknown;
    readonly "idempotency_key": string;
    readonly "project_id": unknown;
    readonly "base_revision": unknown;
    readonly "read_set": readonly (unknown)[];
    readonly "targets": readonly (unknown)[];
    readonly "actor_user_id": unknown;
    readonly "origin": "user" | "agent" | "system";
    readonly "job_ref"?: {
    readonly "business_job_id": unknown;
    readonly "invocation_cause_id": unknown;
  };
    readonly "operation_ref"?: unknown;
    readonly "undo_policy": "recorded" | "exempt_placeholder";
    readonly "undo_group_id"?: unknown;
    readonly "ops": readonly ({
    readonly "op": string;
  })[];
    readonly "issued_at": unknown;
  };
export type CompositionDocument = {
    readonly "schema_version": 1;
    readonly "project_id": unknown;
    readonly "working_copy_version": unknown;
    readonly "canvas": {
    readonly "aspect_ratio": "16:9" | "9:16" | "1:1";
    readonly "width": number;
    readonly "height": number;
    readonly "fps": unknown;
  };
    readonly "brand_kit_ref"?: unknown;
    readonly "sections": readonly ({
    readonly "section_id": unknown;
    readonly "rev": unknown;
    readonly "title": string;
    readonly "script_chapter_id"?: unknown;
  })[];
    readonly "scene_sequence": {
    readonly "rev": unknown;
    readonly "scene_ids": readonly (unknown)[];
  };
    readonly "scenes": readonly (unknown)[];
    readonly "project_overlays": {
    readonly "rev": unknown;
    readonly "layers": readonly ({
    readonly "layer_id": unknown;
    readonly "rev": unknown;
    readonly "overlay_kind": "logo" | "watermark" | "lower_third";
    readonly "media"?: unknown;
    readonly "motion_instance"?: unknown;
    readonly "project_range": unknown;
  })[];
  };
    readonly "audio": {
    readonly "rev": unknown;
    readonly "placements": readonly ({
    readonly "placement_id": unknown;
    readonly "rev": unknown;
    readonly "role": "narration" | "music" | "sfx";
    readonly "source_id": unknown;
    readonly "source_range": unknown;
    readonly "scene_id"?: unknown;
    readonly "scene_range"?: unknown;
    readonly "project_range"?: unknown;
    readonly "gain_db": number;
    readonly "fade_in_ms"?: number;
    readonly "fade_out_ms"?: number;
    readonly "narration_provenance"?: {
    readonly "source_mode": "supplied_audio" | "generated_speech";
    readonly "spec_sha256": unknown;
    readonly "operation_ref"?: unknown;
    readonly "alignment_ref"?: unknown;
  };
  })[];
    readonly "mix_plan"?: {
    readonly "rev": unknown;
    readonly "buses": {
    readonly "voice": unknown;
    readonly "source_dialogue": unknown;
    readonly "music": unknown;
    readonly "sfx": unknown;
    readonly "ambience": unknown;
  };
    readonly "ducking": {
    readonly "depth_db": number;
    readonly "attack_ms": number;
    readonly "release_ms": number;
  };
    readonly "background_level_offset_db": number;
    readonly "automation_envelopes": readonly ({
    readonly "envelope_id": unknown;
    readonly "bus": "voice" | "source_dialogue" | "music" | "sfx" | "ambience";
    readonly "project_range": unknown;
    readonly "gain_db": number;
    readonly "ramp_ms": number;
  })[];
  };
  };
    readonly "caption_tracks": readonly ({
    readonly "caption_track_id": unknown;
    readonly "rev": unknown;
    readonly "source": unknown;
    readonly "style_ref"?: unknown;
    readonly "burn_in": true;
  })[];
    readonly "source_media": readonly ({
    readonly "source_id": unknown;
    readonly "storage_object": unknown;
    readonly "project_asset_grant_id": unknown;
    readonly "probe": {
    readonly "timebase": unknown;
    readonly "vfr": boolean;
    readonly "duration_ticks": number;
    readonly "audio_channels": number;
  };
    readonly "transcript"?: unknown;
    readonly "analysis_refs"?: readonly (unknown)[];
  })[];
    readonly "template_instances"?: readonly (unknown)[];
  };
export type CompositionProject = {
    readonly "id": unknown;
    readonly "tenant_id": unknown;
    readonly "channel_id": unknown;
    readonly "owner_user_id": unknown;
    readonly "title": string;
    readonly "aspect_ratio": "16:9" | "9:16" | "1:1";
    readonly "visibility": "private";
    readonly "schema_version": number;
    readonly "client_request_id": string;
    readonly "request_fingerprint": unknown;
    readonly "working_copy_version": unknown;
    readonly "head_revision_id": (unknown) | (null);
    readonly "renderer_pin": unknown;
    readonly "lifecycle_state": "active" | "archived" | "soft_deleted";
    readonly "created_at": unknown;
    readonly "updated_at": unknown;
  };
export type CompositionRevision = {
    readonly "schema_version": "composition_revision_v1";
    readonly "revision_id": unknown;
    readonly "project_id": unknown;
    readonly "revision_number": unknown;
    readonly "parent_revision_id": (unknown) | (null);
    readonly "cut_from_working_copy_version": unknown;
    readonly "seen_working_copy_version"?: unknown;
    readonly "document_schema_version": number;
    readonly "document_sha256": unknown;
    readonly "cut_reason": "manual_save" | "render_request" | "g2_request" | "manual_export" | "template_save" | "element_save" | "import" | "pre_migration" | "auto_checkpoint";
    readonly "created_by": {
    readonly "actor_user_id": unknown;
    readonly "origin": "user" | "agent" | "system";
  };
    readonly "created_at": unknown;
    readonly "lease_released_at": (unknown) | (null);
  };
export type MotionExposure = {
    readonly "schema_version": "motion_exposure_v1";
    readonly "motion": unknown;
    readonly "source_sha256": unknown;
    readonly "parameter_schema_hash": unknown;
    readonly "renderer_profile_revision": unknown;
    readonly "fps": unknown;
    readonly "aspect_ratios": readonly ("16:9" | "9:16" | "1:1")[];
    readonly "timing": {
    readonly "enter": "fixed" | "stretch" | "loop";
    readonly "hold": "fixed" | "stretch" | "loop";
    readonly "exit": "fixed" | "stretch" | "loop";
  };
    readonly "parameters": readonly (unknown)[];
    readonly "dependencies": readonly ({
    readonly "kind": "font" | "asset";
    readonly "ref_id": unknown;
    readonly "sha256": unknown;
  })[];
  };
export type ProductionRun = {
    readonly "schema_version": "production_run_v1";
    readonly "production_run_id": unknown;
    readonly "project_id": unknown;
    readonly "business_job_id": unknown;
    readonly "envelope_id": unknown;
    readonly "shot_plan": unknown;
    readonly "base_working_copy_version": unknown;
    readonly "state": "planned" | "running" | "partial" | "succeeded" | "failed" | "canceled";
    readonly "generation_shots": readonly (unknown)[];
    readonly "operations": readonly (unknown)[];
    readonly "takes": readonly (unknown)[];
    readonly "created_at": unknown;
  };
export type RenderManifest = {
    readonly "schema_version": "render_manifest_v1";
    readonly "manifest_id": unknown;
    readonly "project_id": unknown;
    readonly "revision_id": unknown;
    readonly "document_sha256": unknown;
    readonly "document_schema_version": number;
    readonly "purpose": "accurate_proxy" | "final";
    readonly "seen_working_copy_version": unknown;
    readonly "canvas": {
    readonly "aspect_ratio": "16:9" | "9:16" | "1:1";
    readonly "width": number;
    readonly "height": number;
    readonly "fps": unknown;
  };
    readonly "renderer_pin": unknown;
    readonly "scene_compiler_version": number;
    readonly "dependencies": {
    readonly "assets": readonly (unknown)[];
    readonly "fonts": readonly (unknown)[];
    readonly "brand": readonly (unknown)[];
    readonly "audio_licenses"?: readonly (unknown)[];
    readonly "motion": readonly ({
    readonly "motion": unknown;
    readonly "parameter_snapshot_sha256": unknown;
  })[];
  };
    readonly "output_profile": {
    readonly "profile_id": string;
    readonly "profile_revision": unknown;
  };
    readonly "qc_profile": {
    readonly "profile_id": string;
    readonly "profile_revision": unknown;
  };
    readonly "anchor_resolution": {
    readonly "report_sha256": unknown;
    readonly "unresolved_count": number;
  };
    readonly "immutable": true;
    readonly "manifest_sha256": unknown;
    readonly "created_at": unknown;
  };
export type RendererRepin = {
    readonly "schema_version": "renderer_repin_v1";
    readonly "repin_id": unknown;
    readonly "project_id": unknown;
    readonly "revision_id": unknown;
    readonly "from_renderer_pin": unknown;
    readonly "to_renderer_pin": unknown;
    readonly "parity_report": {
    readonly "report_id": unknown;
    readonly "qc_profile_revision": unknown;
    readonly "result": "passed" | "failed";
    readonly "report_sha256": unknown;
  };
    readonly "status": "planned" | "parity_failed" | "applied";
    readonly "created_at": unknown;
  };
export type UndoGroup = {
    readonly "schema_version": "composition_undo_group_v1";
    readonly "undo_group_id": unknown;
    readonly "project_id": unknown;
    readonly "actor_user_id": unknown;
    readonly "origin": "user" | "agent" | "system";
    readonly "command_ids": readonly (unknown)[];
    readonly "entity_revs_after": readonly ((unknown) & ({
    readonly "entity_kind"?: unknown;
  }))[];
    readonly "inverse_ops": readonly ({
    readonly "op": string;
  })[];
    readonly "state": "applied" | "undone" | "conflicted" | "evicted";
    readonly "created_at": unknown;
  };

export const reader = new ContractPackageReader({
  package: "composition-project",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
