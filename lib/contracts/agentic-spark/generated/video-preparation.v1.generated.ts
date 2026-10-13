// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/video-preparation/v1
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
  },
  "motion-code-scene-proposal.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/motion-code-scene-proposal.schema.json",
    "title": "motion_code_scene_proposal_v1",
    "description": "P06-35 (additive v1 note): the code scene the job's selected orchestration model writes from the bounded worker package (KARAR-MOTION-MOTORU \u00a76 \"Worker paketi\", Q40 L1/L2): the source files of one `motion-code@1` bundle (an HTML fragment, CSS and the JS that calls `MotionRuntime.define({ init, seek, dispose })`), the manifest parameters the user may edit in Spark (text, colour, media, duration), the catalogue faces it uses and the helper SDK dependency. There is no canvas, frame rate, length, seed, asset or id here: the server owns them and assembles the bundle from the scene it asked for, so a model cannot disagree with the project. The server lints the assembled bundle with the F40 validator, test-renders it in the isolated runner and repairs at most twice with the validator's machine issue codes (never a model text). This document is the output contract of the `l2_scene_package` Assistant sub-job; the limits repeat `MOTION_CODE_LIMITS` of the engine package (the validator enforces the rest).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "summary",
      "files",
      "parameters",
      "dependencies"
    ],
    "properties": {
      "schema_version": {
        "const": "motion_code_scene_proposal_v1"
      },
      "summary": {
        "description": "One sentence the user reads next to the diff: what the scene shows and how it moves.",
        "type": "string",
        "minLength": 1,
        "maxLength": 300
      },
      "files": {
        "description": "The bundle source: at least one .js file, at most one .html fragment.",
        "type": "array",
        "minItems": 1,
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/File"
        }
      },
      "parameters": {
        "description": "`motion_exposure_v1` parameters: the copy, colours and lengths Spark may edit (text, color, media, duration are Spark-editable; number, enum, boolean are authoring-only).",
        "type": "array",
        "maxItems": 64,
        "items": {
          "$ref": "#/$defs/Parameter"
        }
      },
      "fonts": {
        "description": "Catalogue faces of the scene's Video style by family, weight, style and sha256 (no other face exists).",
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/Font"
        }
      },
      "dependencies": {
        "description": "Exactly the harness helper SDK or nothing: there is no package install.",
        "type": "array",
        "maxItems": 1,
        "items": {
          "const": "motion-runtime-sdk@1"
        }
      }
    },
    "$defs": {
      "File": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "path",
          "kind",
          "text"
        ],
        "properties": {
          "path": {
            "description": "Lower-case relative name whose extension is the kind, e.g. scene.js, style.css, markup.html.",
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]{0,47}\\.(js|css|html)$"
          },
          "kind": {
            "enum": [
              "js",
              "css",
              "html"
            ]
          },
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 262144
          }
        }
      },
      "Font": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "family",
          "weight",
          "style",
          "sha256"
        ],
        "properties": {
          "family": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$"
          },
          "weight": {
            "type": "integer",
            "minimum": 100,
            "maximum": 900
          },
          "style": {
            "enum": [
              "normal",
              "italic"
            ]
          },
          "sha256": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          }
        }
      },
      "Parameter": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "parameter_id",
          "kind",
          "required",
          "spark_editable"
        ],
        "properties": {
          "parameter_id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
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
          "required": {
            "type": "boolean"
          },
          "spark_editable": {
            "type": "boolean"
          },
          "default": {
            "description": "A string, a number or a boolean matching the kind (the validator checks the default against the parameter).",
            "type": [
              "string",
              "number",
              "boolean"
            ]
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
                "maxItems": 2,
                "uniqueItems": true,
                "items": {
                  "enum": [
                    "image",
                    "video"
                  ]
                }
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
                "type": "integer",
                "minimum": 1,
                "maximum": 7200
              },
              "max_frames": {
                "type": "integer",
                "minimum": 1,
                "maximum": 7200
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
                  "minLength": 1,
                  "maxLength": 100
                }
              }
            }
          }
        }
      }
    }
  },
  "motion-film-inventory.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/motion-film-inventory.schema.json",
    "title": "motion_film_inventory_v1",
    "description": "P04-20 (additive v1 note): what the job's selected orchestration model writes after it SAW the user's images (KARAR-MOTION-FILM \u00a74.2, Q31): one entry per image with its kind, title, feature match, focus boxes, colours, usage and quality/sensitive-data warnings. The model names an image by the `image_key` it was shown (`img1`...); it never writes an owner ref, a Storage id or a model id: the server binds the key to the exact Storage asset and writes the ShotPlan `AssetInventoryItem` (source `model_vision`). This document is the output contract of the `asset_inventory` Assistant sub-job.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "items"
    ],
    "properties": {
      "schema_version": {
        "const": "motion_film_inventory_v1"
      },
      "items": {
        "type": "array",
        "minItems": 1,
        "maxItems": 10,
        "items": {
          "$ref": "#/$defs/InventoryEntry"
        }
      }
    },
    "$defs": {
      "InventoryEntry": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "image_key",
          "kind",
          "title",
          "usage"
        ],
        "properties": {
          "image_key": {
            "description": "The key the image was shown under (img1, img2, ...).",
            "type": "string",
            "pattern": "^img[0-9]{1,2}$"
          },
          "kind": {
            "enum": [
              "screenshot",
              "photo",
              "logo",
              "product_image",
              "illustration",
              "chart",
              "video",
              "other"
            ]
          },
          "screen_form": {
            "description": "Device class of a screenshot.",
            "enum": [
              "phone",
              "desktop",
              "web"
            ]
          },
          "title": {
            "description": "The main heading the image itself shows (not an invented name).",
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "feature_match": {
            "description": "Which of the user's own feature sentences this image shows, verbatim; empty when none fits.",
            "type": "string",
            "maxLength": 500
          },
          "focus_boxes": {
            "description": "Normalised boxes worth a camera push.",
            "type": "array",
            "maxItems": 10,
            "items": {
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
          },
          "colors": {
            "type": "array",
            "maxItems": 10,
            "items": {
              "type": "string",
              "pattern": "^#[0-9A-Fa-f]{6}$"
            }
          },
          "usage": {
            "enum": [
              "hero",
              "detail",
              "background",
              "reference_only",
              "do_not_use"
            ]
          },
          "quality_warning": {
            "description": "Low resolution, crop risk, an outdated interface.",
            "type": "string",
            "maxLength": 500
          },
          "sensitive_data_warning": {
            "description": "An e-mail address, phone number or other personal data the image shows.",
            "type": "string",
            "maxLength": 500
          },
          "ui_score": {
            "description": "P04-22: for an interface screenshot only, the four criteria of 0-2 points each: is it current, is it simple, does it fit the brand, does it show the proof moment. The server adds the total and derives the treatment (real, simplify or redraw); the model never writes either.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "current",
              "simple",
              "on_brand",
              "shows_proof"
            ],
            "properties": {
              "current": {
                "type": "integer",
                "minimum": 0,
                "maximum": 2
              },
              "simple": {
                "type": "integer",
                "minimum": 0,
                "maximum": 2
              },
              "on_brand": {
                "type": "integer",
                "minimum": 0,
                "maximum": 2
              },
              "shows_proof": {
                "type": "integer",
                "minimum": 0,
                "maximum": 2
              }
            }
          }
        }
      }
    }
  },
  "motion-film-storyboard-proposal.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/motion-film-storyboard-proposal.schema.json",
    "title": "motion_film_storyboard_proposal_v1",
    "description": "P04-20 (additive v1 note): the storyboard the job's selected orchestration model proposes from the brief and the asset inventory (KARAR-MOTION-FILM \u00a74.3): the one message the film proves, the direction block written once, and one scene per beat with its role, story beat, persuasion, focal point, library pattern (chosen from the role -> pattern menu), energy, length, the exact quoted on-screen copy, the inventory assets it shows and the SlotMediaRequests of slots no user asset fills. There are no pixels, ease curves, milliseconds, code or ids here: the server derives the arc ranges from the scene lengths, assigns the stable script and shot ids, writes the ScriptArtifact and the ShotPlan and asks the model for the per-scene MotionShotSpec only afterwards, with the slot schema of the chosen pattern alone. This document is the output contract of the `motion_storyboard` Assistant sub-job.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "message",
      "direction",
      "scenes"
    ],
    "properties": {
      "schema_version": {
        "const": "motion_film_storyboard_proposal_v1"
      },
      "message": {
        "description": "The single sentence the film proves.",
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "audience": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "direction": {
        "description": "The management block written once for every scene.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "palette_roles",
          "motion_grammar",
          "reveal_model",
          "prohibited"
        ],
        "properties": {
          "palette_roles": {
            "type": "array",
            "minItems": 1,
            "maxItems": 7,
            "uniqueItems": true,
            "items": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/ColorRoleToken"
            }
          },
          "motion_grammar": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500
          },
          "reveal_model": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500
          },
          "prohibited": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            }
          }
        }
      },
      "hero_scene": {
        "description": "P04-22: the 0-based index of the scene whose finished frame the film is best remembered by (the shareable hero frame, offered as a free engine-frame thumbnail candidate of the publish package). The server picks the frame inside that scene once its content is revealed; absent = the server picks the first proof scene.",
        "type": "integer",
        "minimum": 0,
        "maximum": 39
      },
      "scenes": {
        "type": "array",
        "minItems": 1,
        "maxItems": 40,
        "items": {
          "$ref": "#/$defs/Scene"
        }
      }
    },
    "$defs": {
      "AssetKey": {
        "description": "`asset:<resource_id>` of an inventory asset, exactly as the inventory names it.",
        "type": "string",
        "pattern": "^asset:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "Scene": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "role",
          "beat",
          "pattern_ref",
          "energy",
          "duration_seconds",
          "texts"
        ],
        "properties": {
          "role": {
            "description": "Scene role: hook, problem, product_intro, feature, benefit, proof, cta or brand_outro.",
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,47}$"
          },
          "beat": {
            "enum": [
              "hook",
              "reveal",
              "feature_loop",
              "proof",
              "breather",
              "cta"
            ]
          },
          "persuasion": {
            "type": "string",
            "minLength": 1,
            "maxLength": 300
          },
          "focal": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "pattern_ref": {
            "description": "`id@revision` from the role -> pattern menu; never a pattern the menu did not offer for this role.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/SemverRevisionRef"
          },
          "energy": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/Energy"
          },
          "duration_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 60
          },
          "texts": {
            "description": "The exact on-screen copy of the scene, in reading order; rendered as written (never rewritten by the compiler).",
            "type": "array",
            "maxItems": 8,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            }
          },
          "asset_keys": {
            "description": "The inventory assets this scene shows.",
            "type": "array",
            "maxItems": 4,
            "uniqueItems": true,
            "items": {
              "$ref": "#/$defs/AssetKey"
            }
          },
          "media_requests": {
            "description": "Typed requests for media slots no user asset fills (paid production only after G1; a labelled placeholder before).",
            "type": "array",
            "maxItems": 4,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "slot_id",
                "purpose",
                "prompt",
                "motion_need",
                "time_policy"
              ],
              "properties": {
                "slot_id": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 64
                },
                "purpose": {
                  "enum": [
                    "atmosphere",
                    "usage_moment",
                    "background",
                    "product_screen"
                  ]
                },
                "prompt": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1000
                },
                "reference_asset_keys": {
                  "type": "array",
                  "maxItems": 4,
                  "uniqueItems": true,
                  "items": {
                    "$ref": "#/$defs/AssetKey"
                  }
                },
                "motion_need": {
                  "enum": [
                    "static",
                    "camera",
                    "subject"
                  ]
                },
                "time_policy": {
                  "enum": [
                    "hold_last_frame",
                    "trim_slot",
                    "reject"
                  ]
                }
              }
            }
          }
        }
      }
    }
  },
  "motion-scene-request.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/motion-scene-request.schema.json",
    "title": "motion_scene_request_v1",
    "description": "P06-35 (additive v1 note): the typed `motion.scene.generate` request (Q16 mixed path, KARAR-SPARK-SAHNE-SERIDI \u00a74 and KARAR-MOTION-MOTORU \u00a76 Q40): the director asks for one scene whose custom motion graphic the library cannot express (a route with a plane, a data chart, a brand intro) to be written as code in the isolated runner. It carries the intent and the scene the code must show, never code: the copy of the scene (text, number and list slots), its length and its role, the pinned Video style preset, the nearest library pattern the scene keeps when the code fails, and, for a structural change of an existing project-private revision, that revision. The server derives the canvas and the frame rate from the project, the level from the request kind (decideMotionAuthoring), the price lines and every id; the project and the job come from the job context. Media slots are not part of v1 (their asset pins need the Storage owner). This document is the input of the Assistant tool `composition.production_plan.generate_motion_scene`.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "request_kind",
      "instruction",
      "scene",
      "video_style"
    ],
    "properties": {
      "schema_version": {
        "const": "motion_scene_request_v1"
      },
      "request_kind": {
        "description": "Why code is written (Q40 triggers, K287): explicit_code = the user asked for it; library_gap = the library has no pattern for the move; quality_upgrade = the user asked for a more original result (or the Quality profile needs it); original_code = the user asked for fully original code (L2). The dislike ladder is the director's: its free steps come first and never reach this tool.",
        "enum": [
          "explicit_code",
          "library_gap",
          "quality_upgrade",
          "original_code"
        ]
      },
      "scope": {
        "description": "A whole scene (default) or one component of a scene. Absent = scene.",
        "enum": [
          "scene",
          "component"
        ]
      },
      "instruction": {
        "description": "What the scene must show and how it should move, in the user's own words; for a structural change, the change.",
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "scene": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "duration_seconds"
        ],
        "properties": {
          "role": {
            "description": "Scene role: hook, product_intro, feature, proof, cta, ...",
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,47}$"
          },
          "duration_seconds": {
            "description": "Length of the scene; the server turns it into whole frames at the project's frame rate.",
            "type": "number",
            "minimum": 0.5,
            "maximum": 120
          },
          "slots": {
            "description": "The copy the code must show, exposed as manifest parameters.",
            "type": "array",
            "maxItems": 24,
            "items": {
              "$ref": "#/$defs/Slot"
            }
          }
        }
      },
      "video_style": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "preset_ref"
        ],
        "properties": {
          "preset_ref": {
            "description": "`id@revision` of a platform Video style preset; its colour and typography roles are the code's only palette and faces.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/SemverRevisionRef"
          }
        }
      },
      "fallback_blueprint_ref": {
        "description": "The nearest library pattern the scene keeps (with the `fallback_used` attention) when the code cannot be validated. Absent = the scene stays as it was.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/SemverRevisionRef"
      },
      "base_revision_id": {
        "description": "Structural change of an existing project-private Motion code revision: the result is the next revision of the same lineage with a diff, never a change of this one.",
        "type": "string",
        "pattern": "^cmrev_[0-9a-f-]{36}$"
      }
    },
    "$defs": {
      "Slot": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "slot_id",
          "kind",
          "value"
        ],
        "properties": {
          "slot_id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          },
          "kind": {
            "enum": [
              "text",
              "number",
              "list"
            ]
          },
          "value": {}
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "text"
                }
              }
            },
            "then": {
              "properties": {
                "value": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 500
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "number"
                }
              }
            },
            "then": {
              "properties": {
                "value": {
                  "type": "number"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "list"
                }
              }
            },
            "then": {
              "properties": {
                "value": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 12,
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 200
                  }
                }
              }
            }
          }
        ]
      }
    }
  },
  "plan-change-impact.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/plan-change-impact.schema.json",
    "title": "plan_change_impact_v1",
    "description": "P04-10 (additive v1 note): the dependency impact of one production plan revision against another of the same job (usually the approved/presented one against the current head), derived by the Composition owner from the two plan bodies and their pinned brief/script/shot plan. Operations are matched by their stable operation_key: an unchanged input hash keeps the operation (a successful result stays usable), a changed one is a paid regeneration, a new key is added paid work, a missing key is removed planned work (spent credits stay spent). Edits that change no paid operation (on-screen text, scene layout, transition, caption, order, titles) are free local edits. An approval never carries to a plan with another G1 fingerprint; whether the change needs a new decision (Ask: new G1; Auto: the policy) is decided by the Assistant from this record. Read-only projection; never stored as a plan body.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "job_id",
      "from_plan_ref",
      "to_plan_ref",
      "approval",
      "changes",
      "operations",
      "free_local_edits",
      "estimate",
      "decision"
    ],
    "properties": {
      "schema_version": {
        "const": "plan_change_impact_v1"
      },
      "job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "from_plan_ref": {
        "allOf": [
          {
            "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
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
      "to_plan_ref": {
        "allOf": [
          {
            "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
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
      "approval": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "from_g1_fingerprint_sha256",
          "to_g1_fingerprint_sha256",
          "carries_over"
        ],
        "properties": {
          "from_g1_fingerprint_sha256": {
            "oneOf": [
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              },
              {
                "type": "null"
              }
            ]
          },
          "to_g1_fingerprint_sha256": {
            "oneOf": [
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              },
              {
                "type": "null"
              }
            ]
          },
          "carries_over": {
            "description": "true only when both plans are ready with the same G1 fingerprint (the old approval is for this exact plan).",
            "type": "boolean"
          }
        }
      },
      "changes": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "brief_fields",
          "script",
          "shots",
          "scenes"
        ],
        "properties": {
          "brief_fields": {
            "type": "array",
            "maxItems": 50,
            "uniqueItems": true,
            "items": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{0,63}$"
            }
          },
          "script": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "narration_changed_beat_ids",
              "added_beat_ids",
              "removed_beat_ids"
            ],
            "properties": {
              "narration_changed_beat_ids": {
                "$ref": "#/$defs/IdList"
              },
              "added_beat_ids": {
                "$ref": "#/$defs/IdList"
              },
              "removed_beat_ids": {
                "$ref": "#/$defs/IdList"
              }
            }
          },
          "shots": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "added",
              "removed",
              "changed"
            ],
            "properties": {
              "added": {
                "$ref": "#/$defs/IdList"
              },
              "removed": {
                "$ref": "#/$defs/IdList"
              },
              "changed": {
                "type": "array",
                "maxItems": 500,
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "shot_id",
                    "fields"
                  ],
                  "properties": {
                    "shot_id": {
                      "$ref": "common.schema.json#/$defs/StableId"
                    },
                    "fields": {
                      "type": "array",
                      "maxItems": 40,
                      "uniqueItems": true,
                      "items": {
                        "type": "string",
                        "pattern": "^[a-z][a-z0-9_]{0,63}$"
                      }
                    }
                  }
                }
              }
            }
          },
          "scenes": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "added",
              "removed",
              "changed"
            ],
            "properties": {
              "added": {
                "$ref": "#/$defs/IdList"
              },
              "removed": {
                "$ref": "#/$defs/IdList"
              },
              "changed": {
                "$ref": "#/$defs/IdList"
              }
            }
          }
        }
      },
      "operations": {
        "type": "array",
        "maxItems": 1000,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "operation_key",
            "effect",
            "category",
            "shot_ids",
            "reasons"
          ],
          "properties": {
            "operation_key": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_.-]{0,127}$"
            },
            "effect": {
              "enum": [
                "unchanged",
                "paid_regeneration",
                "added",
                "removed"
              ]
            },
            "from_operation_id": {
              "$ref": "common.schema.json#/$defs/OperationId"
            },
            "to_operation_id": {
              "$ref": "common.schema.json#/$defs/OperationId"
            },
            "category": {
              "enum": [
                "image",
                "video",
                "voice",
                "avatar",
                "other"
              ]
            },
            "shot_ids": {
              "type": "array",
              "maxItems": 64,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/StableId"
              }
            },
            "credits_delta": {
              "description": "to - from planned credits of the operation (a removed operation is negative; spent credits are not refunded by a plan change).",
              "type": "number",
              "multipleOf": 0.0001
            },
            "reasons": {
              "type": "array",
              "maxItems": 10,
              "uniqueItems": true,
              "items": {
                "enum": [
                  "prompt_changed",
                  "model_changed",
                  "duration_changed",
                  "quality_changed",
                  "reference_changed",
                  "text_changed",
                  "voice_changed",
                  "format_changed",
                  "upstream_changed",
                  "input_changed",
                  "new_operation",
                  "operation_removed"
                ]
              }
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "effect": {
                    "enum": [
                      "unchanged",
                      "paid_regeneration",
                      "removed"
                    ]
                  }
                }
              },
              "then": {
                "required": [
                  "from_operation_id"
                ]
              }
            },
            {
              "if": {
                "properties": {
                  "effect": {
                    "enum": [
                      "unchanged",
                      "paid_regeneration",
                      "added"
                    ]
                  }
                }
              },
              "then": {
                "required": [
                  "to_operation_id"
                ]
              }
            }
          ]
        }
      },
      "free_local_edits": {
        "type": "array",
        "maxItems": 500,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "ref"
          ],
          "properties": {
            "kind": {
              "enum": [
                "on_screen_text",
                "scene_layout",
                "transition",
                "caption",
                "shot_order",
                "section_title"
              ]
            },
            "ref": {
              "type": "string",
              "minLength": 1,
              "maxLength": 128
            }
          }
        }
      },
      "estimate": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "from_status",
          "to_status",
          "from_max_credits",
          "to_max_credits",
          "delta_max_credits"
        ],
        "properties": {
          "from_status": {
            "enum": [
              "valid",
              "computing",
              "stale",
              "unavailable"
            ]
          },
          "to_status": {
            "enum": [
              "valid",
              "computing",
              "stale",
              "unavailable"
            ]
          },
          "from_max_credits": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Credits"
              },
              {
                "type": "null"
              }
            ]
          },
          "to_max_credits": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Credits"
              },
              {
                "type": "null"
              }
            ]
          },
          "delta_max_credits": {
            "oneOf": [
              {
                "type": "number",
                "multipleOf": 0.0001
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "decision": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "paid_change",
          "scope_exceeded",
          "approved_max_credits",
          "requires_new_decision",
          "reasons"
        ],
        "properties": {
          "paid_change": {
            "description": "Some operation is regenerated or added.",
            "type": "boolean"
          },
          "scope_exceeded": {
            "description": "The target plan's maximum exceeds the approved ceiling (unknown maximum counts as exceeded).",
            "type": "boolean"
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
          "requires_new_decision": {
            "type": "boolean"
          },
          "reasons": {
            "type": "array",
            "maxItems": 10,
            "uniqueItems": true,
            "items": {
              "enum": [
                "paid_operations_changed",
                "estimate_exceeds_approved_scope",
                "estimate_not_valid",
                "target_plan_not_ready"
              ]
            }
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "approval": {
              "properties": {
                "carries_over": {
                  "const": true
                }
              }
            }
          }
        },
        "then": {
          "properties": {
            "decision": {
              "properties": {
                "requires_new_decision": {
                  "const": false
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "IdList": {
        "type": "array",
        "maxItems": 500,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/StableId"
        }
      }
    }
  },
  "preparation-artifact-revision.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/preparation-artifact-revision.schema.json",
    "title": "preparation_artifact_revision_v1",
    "description": "Common envelope of one immutable preparation artifact revision (KARAR \u00a74 'ortak zarf'): schema version, artifact/job/project identity, revision + parent, content digest, owner scope, dependency refs, provenance, server readiness and creation time. The body is read separately (paged, preparation_body_page_v1); SSE/outbox/tool observations carry only this envelope or its refs.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "artifact_id",
      "artifact_kind",
      "project_id",
      "job_id",
      "revision",
      "parent_revision",
      "body_schema_version",
      "content_digest_sha256",
      "body_bytes",
      "dependency_refs",
      "provenance",
      "readiness",
      "validation_summary",
      "created_by",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "preparation_artifact_revision_v1"
      },
      "artifact_id": {
        "$ref": "common.schema.json#/$defs/ArtifactId"
      },
      "artifact_kind": {
        "$ref": "common.schema.json#/$defs/ArtifactKind"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "revision": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
      },
      "parent_revision": {
        "oneOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          {
            "type": "null"
          }
        ]
      },
      "body_schema_version": {
        "enum": [
          "video_brief_v1",
          "research_pack_v1",
          "script_artifact_v1",
          "shot_plan_v1",
          "production_plan_v1"
        ]
      },
      "content_digest_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "body_bytes": {
        "type": "integer",
        "minimum": 2
      },
      "dependency_refs": {
        "type": "array",
        "maxItems": 10,
        "items": {
          "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
        }
      },
      "provenance": {
        "$ref": "common.schema.json#/$defs/Provenance"
      },
      "readiness": {
        "$ref": "common.schema.json#/$defs/Readiness"
      },
      "validation_summary": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "validator_revision",
          "error_count",
          "warning_count"
        ],
        "properties": {
          "validator_revision": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
          },
          "error_count": {
            "type": "integer",
            "minimum": 0
          },
          "warning_count": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "g1_fingerprint_sha256": {
        "description": "Server-computed semantic fingerprint of a ready production plan revision (content, refs, estimate revision, pricing snapshot, ceiling, execution pins, bindings). A G1 decision binds to it; any change creates a new revision and a new fingerprint.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
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
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "origin": {
            "enum": [
              "agent",
              "user",
              "system"
            ]
          }
        }
      },
      "created_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "revision": {
              "const": 1
            }
          }
        },
        "then": {
          "properties": {
            "parent_revision": {
              "type": "null"
            }
          }
        },
        "else": {
          "properties": {
            "parent_revision": {
              "type": "integer"
            }
          }
        }
      },
      {
        "if": {
          "required": [
            "g1_fingerprint_sha256"
          ]
        },
        "then": {
          "properties": {
            "artifact_kind": {
              "const": "production_plan"
            },
            "readiness": {
              "enum": [
                "ready",
                "stale"
              ]
            }
          }
        }
      }
    ]
  },
  "preparation-body-page.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/preparation-body-page.schema.json",
    "title": "preparation_body_page_v1",
    "description": "One bounded page of an exact artifact revision body (K197: an 8-chapter script is read in full through pages; a truncated summary never replaces the script). section=header carries the body without its paged arrays; chapters/shots/sources/claims page those arrays in stored order. The cursor is opaque and bound to the exact revision + digest; opening/reading never runs inference or media.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "artifact_ref",
      "section",
      "items",
      "total_items",
      "next_cursor"
    ],
    "properties": {
      "schema_version": {
        "const": "preparation_body_page_v1"
      },
      "artifact_ref": {
        "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
      },
      "section": {
        "enum": [
          "header",
          "chapters",
          "shots",
          "sources",
          "claims"
        ]
      },
      "items": {
        "type": "array",
        "maxItems": 200
      },
      "total_items": {
        "type": "integer",
        "minimum": 0
      },
      "next_cursor": {
        "oneOf": [
          {
            "type": "string",
            "pattern": "^[A-Za-z0-9_-]{1,512}$"
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
            "section": {
              "const": "header"
            }
          }
        },
        "then": {
          "properties": {
            "items": {
              "maxItems": 1,
              "items": {
                "type": "object"
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "section": {
              "const": "chapters"
            }
          }
        },
        "then": {
          "properties": {
            "items": {
              "items": {
                "$ref": "script-artifact.schema.json#/$defs/Chapter"
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "section": {
              "const": "shots"
            }
          }
        },
        "then": {
          "properties": {
            "items": {
              "items": {
                "$ref": "shot-plan.schema.json#/$defs/Shot"
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "section": {
              "const": "sources"
            }
          }
        },
        "then": {
          "properties": {
            "items": {
              "items": {
                "$ref": "research-pack.schema.json#/$defs/Source"
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "section": {
              "const": "claims"
            }
          }
        },
        "then": {
          "properties": {
            "items": {
              "items": {
                "$ref": "research-pack.schema.json#/$defs/Claim"
              }
            }
          }
        }
      }
    ]
  },
  "preparation-validation-report.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/preparation-validation-report.schema.json",
    "title": "preparation_validation_report_v1",
    "description": "Server validation of one preparation artifact revision: schema, semantic (ids, refs), coverage (full narration, claim support, beat coverage), timing, capability (real catalog nodes) and estimate validators. A production plan is ready only when every applicable validator passed (\u00a74 Ready kural\u0131). Valid syntax is not proof of factual truth.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "artifact_ref",
      "readiness",
      "validator_revision",
      "validators",
      "issues",
      "issues_truncated",
      "validated_at"
    ],
    "properties": {
      "schema_version": {
        "const": "preparation_validation_report_v1"
      },
      "artifact_ref": {
        "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
      },
      "readiness": {
        "enum": [
          "draft",
          "not_ready",
          "ready"
        ]
      },
      "validator_revision": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
      },
      "validators": {
        "type": "array",
        "minItems": 1,
        "maxItems": 6,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "validator",
            "status",
            "error_count"
          ],
          "properties": {
            "validator": {
              "$ref": "common.schema.json#/$defs/ValidatorName"
            },
            "status": {
              "enum": [
                "passed",
                "failed",
                "not_applicable"
              ]
            },
            "error_count": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      },
      "issues": {
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "common.schema.json#/$defs/ValidationIssue"
        }
      },
      "issues_truncated": {
        "type": "boolean"
      },
      "validated_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "production-plan-summary.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/production-plan-summary.schema.json",
    "title": "production_plan_summary_v1",
    "description": "Composition-owned read projection of one job's preparation package (the composition.production_plan.read tool result, the Plan view header and the G1 card source). Every counter is derived from the stored ShotPlan/ScriptArtifact revisions (K220: shots, new outputs and reused assets are separate; no naive shots x credits). Heads, pinned revisions and staleness are exact; nothing here is a UI copy of the script.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "project_id",
      "job_id",
      "plan",
      "artifacts",
      "counts",
      "estimate_box",
      "issues"
    ],
    "properties": {
      "schema_version": {
        "const": "production_plan_summary_v1"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "plan": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "artifact_ref",
          "readiness"
        ],
        "properties": {
          "artifact_ref": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
              },
              {
                "type": "null"
              }
            ]
          },
          "readiness": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Readiness"
              },
              {
                "const": "missing"
              }
            ]
          },
          "g1_fingerprint_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "output_goal": {
            "enum": [
              "final_video",
              "preview_only",
              "plan_only",
              "script_only"
            ]
          }
        }
      },
      "artifacts": {
        "type": "array",
        "maxItems": 5,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "artifact_kind",
            "artifact_id",
            "head_revision",
            "head_digest_sha256",
            "head_readiness",
            "pinned_revision",
            "stale"
          ],
          "properties": {
            "artifact_kind": {
              "$ref": "common.schema.json#/$defs/ArtifactKind"
            },
            "artifact_id": {
              "$ref": "common.schema.json#/$defs/ArtifactId"
            },
            "head_revision": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
            },
            "head_digest_sha256": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
            },
            "head_readiness": {
              "enum": [
                "draft",
                "not_ready",
                "ready"
              ]
            },
            "pinned_revision": {
              "description": "The revision the plan's head pins (null for the plan itself or when not pinned).",
              "oneOf": [
                {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
                },
                {
                  "type": "null"
                }
              ]
            },
            "stale": {
              "type": "boolean"
            }
          }
        }
      },
      "counts": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "target_seconds",
          "planned_seconds",
          "chapters_total",
          "chapters_enabled",
          "chapters_with_full_narration",
          "beats_total",
          "shots_total",
          "new_image_outputs",
          "new_video_outputs",
          "new_audio_outputs",
          "reused_unique_assets",
          "generated_seconds"
        ],
        "properties": {
          "target_seconds": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Seconds"
              },
              {
                "type": "null"
              }
            ]
          },
          "planned_seconds": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Seconds"
              },
              {
                "type": "null"
              }
            ]
          },
          "chapters_total": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ]
          },
          "chapters_enabled": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ]
          },
          "chapters_with_full_narration": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ]
          },
          "beats_total": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ]
          },
          "shots_total": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ]
          },
          "new_image_outputs": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ]
          },
          "new_video_outputs": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ]
          },
          "new_audio_outputs": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ]
          },
          "reused_unique_assets": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ]
          },
          "generated_seconds": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Seconds"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "estimate_box": {
        "description": "The 8G minimal estimate box; unknown values stay null (never 0).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status",
          "approved_max_credits",
          "includes_final_render"
        ],
        "properties": {
          "status": {
            "enum": [
              "valid",
              "computing",
              "stale",
              "unavailable",
              "missing"
            ]
          },
          "estimate_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          "point_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          "min_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          "max_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
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
          "includes_final_render": {
            "oneOf": [
              {
                "type": "boolean"
              },
              {
                "type": "null"
              }
            ]
          },
          "expires_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          }
        }
      },
      "issues": {
        "type": "array",
        "maxItems": 20,
        "items": {
          "$ref": "common.schema.json#/$defs/ValidationIssue"
        }
      }
    }
  },
  "production-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/production-plan.schema.json",
    "title": "production_plan_v1",
    "description": "ProductionPlan body (KARAR \u00a74, \u00a712A, 8D, 8G): exact revision refs of the brief/research/script/shot plan, the execution ref (compiled DAG/implementation pins, or pending the P04-15 compiler), the estimate from the Workflow/Billing pricing path (never an LLM number, never a fake zero), the budget/repair/timing policy and resolved avatar/voice/template/element/kit bindings with selection provenance. The G1 semantic fingerprint, readiness and validation report are server-computed on the revision, never supplied here. The Plan view and Canvas counters derive from these records; no second UI plan exists.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "refs",
      "execution",
      "estimate",
      "budget_policy",
      "bindings"
    ],
    "properties": {
      "schema_version": {
        "const": "production_plan_v1"
      },
      "refs": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "brief",
          "script",
          "shot_plan"
        ],
        "properties": {
          "brief": {
            "allOf": [
              {
                "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
              },
              {
                "properties": {
                  "artifact_kind": {
                    "const": "video_brief"
                  }
                }
              }
            ]
          },
          "research": {
            "allOf": [
              {
                "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
              },
              {
                "properties": {
                  "artifact_kind": {
                    "const": "research_pack"
                  }
                }
              }
            ]
          },
          "script": {
            "allOf": [
              {
                "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
              },
              {
                "properties": {
                  "artifact_kind": {
                    "const": "script"
                  }
                }
              }
            ]
          },
          "shot_plan": {
            "allOf": [
              {
                "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
              },
              {
                "properties": {
                  "artifact_kind": {
                    "const": "shot_plan"
                  }
                }
              }
            ]
          }
        }
      },
      "execution": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status",
          "node_impl_pins"
        ],
        "properties": {
          "status": {
            "description": "pending_compiler: the plan's DAG is not compiled yet (the compiler is outside the P04-15 schema slice); such a plan cannot be ready.",
            "enum": [
              "compiled",
              "pending_compiler"
            ]
          },
          "dsl_hash": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "workflow_draft_ref": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "draft_id",
              "dsl_hash"
            ],
            "properties": {
              "draft_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "dsl_hash": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              }
            }
          },
          "node_impl_pins": {
            "type": "array",
            "maxItems": 100,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "node_type",
                "implementation_revision"
              ],
              "properties": {
                "node_type": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]*(@[0-9]+)?$",
                  "maxLength": 128
                },
                "implementation_revision": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 128
                },
                "node_key": {
                  "description": "P04-15 compiler (additive v1 note): the DSL node uid this pin belongs to.",
                  "$ref": "#/$defs/NodeKey"
                }
              }
            }
          },
          "operation_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 5000
          },
          "compiler_revision": {
            "description": "P04-15 compiler (additive v1 note): the compiler that produced this execution.",
            "type": "string",
            "pattern": "^vplan-compiler-v[0-9]{1,4}$"
          },
          "execution_dsl_hash": {
            "description": "P04-15 compiler (additive v1 note): P00-09 execution_dsl_hash of the compiled execution DSL (server-computed at the estimate; launch and recovery keep it).",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "pin_fingerprint_hash": {
            "description": "P04-15 compiler (additive v1 note): P00-09 pin_fingerprint_hash over {execution_dsl_hash, node_impl_pins} of the full server pin package.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "estimate_ref": {
            "description": "P04-15 compiler (additive v1 note): the persisted Workflow estimate (P00-09 source_estimate_ref) that holds the full node implementation pins, the execution DSL hash and the priced nodes. The pins stay server-side; this body carries their projection only.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "workflow_estimate_id",
              "expires_at"
            ],
            "properties": {
              "workflow_estimate_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "expires_at": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
              }
            }
          },
          "operations": {
            "description": "P04-15 compiler (additive v1 note): the compiled logical operations (one per active GenerationShot and one TTS operation per narrated scene) and their DSL node, dependencies, retry limit, price and ClipInstance target. The execution (P04-08) binds and launches exactly these.",
            "type": "array",
            "maxItems": 500,
            "items": {
              "$ref": "#/$defs/CompiledOperation"
            }
          },
          "compile_issues": {
            "description": "P04-15 compiler (additive v1 note): why the ShotPlan could not be compiled (e.g. an unsupported media path). Each issue makes the plan not_ready; nothing is silently dropped.",
            "type": "array",
            "maxItems": 50,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "code"
              ],
              "properties": {
                "code": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]{0,63}$"
                },
                "ref": {
                  "type": "string",
                  "maxLength": 128
                }
              }
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "status": {
                  "const": "compiled"
                }
              }
            },
            "then": {
              "required": [
                "dsl_hash",
                "operation_count"
              ],
              "properties": {
                "node_impl_pins": {
                  "minItems": 1
                }
              }
            }
          }
        ]
      },
      "estimate": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status",
          "currency_unit",
          "includes_final_render",
          "line_items"
        ],
        "properties": {
          "status": {
            "description": "valid: priced on a current pricing snapshot. computing/stale/unavailable never read as zero and never make a paid plan ready (8D, K235).",
            "enum": [
              "valid",
              "computing",
              "stale",
              "unavailable"
            ]
          },
          "estimate_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          "pricing_snapshot_hash": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "currency_unit": {
            "const": "credits"
          },
          "point_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          "min_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          "max_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          "preparation_spent_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          "includes_final_render": {
            "type": "boolean"
          },
          "line_items": {
            "type": "array",
            "maxItems": 200,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "item_id",
                "category",
                "operation_count",
                "credits_min",
                "credits_max"
              ],
              "properties": {
                "item_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "category": {
                  "enum": [
                    "research",
                    "script",
                    "image",
                    "video",
                    "voice",
                    "avatar",
                    "stock",
                    "render",
                    "repair",
                    "other"
                  ]
                },
                "operation_count": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 5000
                },
                "output_count": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 5000
                },
                "units_seconds": {
                  "$ref": "common.schema.json#/$defs/Seconds"
                },
                "credits_min": {
                  "$ref": "common.schema.json#/$defs/Credits"
                },
                "credits_max": {
                  "$ref": "common.schema.json#/$defs/Credits"
                },
                "shot_ids": {
                  "type": "array",
                  "maxItems": 500,
                  "uniqueItems": true,
                  "items": {
                    "$ref": "common.schema.json#/$defs/StableId"
                  }
                },
                "capability": {
                  "$ref": "common.schema.json#/$defs/CapabilityRef"
                }
              }
            }
          },
          "computed_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "expires_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "status": {
                  "const": "valid"
                }
              }
            },
            "then": {
              "required": [
                "estimate_revision",
                "pricing_snapshot_hash",
                "min_credits",
                "max_credits",
                "computed_at",
                "expires_at"
              ]
            }
          }
        ]
      },
      "budget_policy": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "approved_max_credits",
          "repair_attempts_max",
          "timing_fit"
        ],
        "properties": {
          "approved_max_credits": {
            "description": "The job's spend ceiling shown with the plan (Billing owns the envelope). null = no ceiling granted yet; the G1 decision names the ceiling it approves.",
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Credits"
              },
              {
                "type": "null"
              }
            ]
          },
          "repair_attempts_max": {
            "type": "integer",
            "minimum": 0,
            "maximum": 5
          },
          "timing_fit": {
            "description": "What an approved fit may change after TTS (\u00a77): hold/trim/transition/bounded pause only, never narration.",
            "enum": [
              "hold_trim_pause",
              "none"
            ]
          }
        }
      },
      "bindings": {
        "type": "array",
        "maxItems": 100,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "role",
            "target",
            "resource",
            "selection_source"
          ],
          "properties": {
            "role": {
              "enum": [
                "avatar",
                "voice",
                "template",
                "intro",
                "outro",
                "element",
                "kit"
              ]
            },
            "target": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "scope"
              ],
              "properties": {
                "scope": {
                  "enum": [
                    "global",
                    "shot",
                    "slot"
                  ]
                },
                "shot_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "slot_id": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 128
                }
              },
              "allOf": [
                {
                  "if": {
                    "properties": {
                      "scope": {
                        "const": "shot"
                      }
                    }
                  },
                  "then": {
                    "required": [
                      "shot_id"
                    ]
                  }
                },
                {
                  "if": {
                    "properties": {
                      "scope": {
                        "const": "slot"
                      }
                    }
                  },
                  "then": {
                    "required": [
                      "slot_id"
                    ]
                  }
                }
              ]
            },
            "resource": {
              "description": "null is an explicit choice (e.g. 'avatar yok / yaln\u0131z seslendirme').",
              "oneOf": [
                {
                  "$ref": "common.schema.json#/$defs/OwnerResourceRef"
                },
                {
                  "type": "null"
                }
              ]
            },
            "selection_source": {
              "$ref": "common.schema.json#/$defs/SelectionSource"
            },
            "rule_ref": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
            }
          }
        }
      }
    },
    "$defs": {
      "NodeKey": {
        "description": "Workflow DSL v2 node uid (runtime node_key).",
        "type": "string",
        "pattern": "^[A-Za-z][A-Za-z0-9_-]{2,127}$"
      },
      "CompiledOperation": {
        "description": "P04-15 compiler (additive v1 note): one logical paid operation of the compiled execution. operation_key is the stable plan identity (the GenerationShot id, or 'narration.<scene_id>'); input_hash covers the node type, its inputs and its upstream input hashes, so a changed input or upstream is a new operation_id (paid regeneration) and an unchanged one keeps it (P04-10 impact).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "operation_id",
          "operation_key",
          "node_key",
          "node_type",
          "category",
          "shot_ids",
          "depends_on",
          "input_hash",
          "retry_limit"
        ],
        "properties": {
          "operation_id": {
            "$ref": "common.schema.json#/$defs/OperationId"
          },
          "operation_key": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.-]{0,127}$"
          },
          "node_key": {
            "$ref": "#/$defs/NodeKey"
          },
          "node_type": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(@[0-9]+)?$",
            "maxLength": 128
          },
          "capability": {
            "$ref": "common.schema.json#/$defs/CapabilityRef"
          },
          "category": {
            "enum": [
              "image",
              "video",
              "voice",
              "avatar",
              "other"
            ]
          },
          "output_kind": {
            "enum": [
              "image",
              "video",
              "audio",
              "avatar_video"
            ]
          },
          "shot_ids": {
            "type": "array",
            "maxItems": 64,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/StableId"
            }
          },
          "generation_shot_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "scene_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "depends_on": {
            "type": "array",
            "maxItems": 20,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/OperationId"
            }
          },
          "input_hash": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "generated_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "retry_limit": {
            "type": "integer",
            "minimum": 0,
            "maximum": 5
          },
          "estimated_credits": {
            "$ref": "common.schema.json#/$defs/Credits"
          },
          "clip_target": {
            "$ref": "common.schema.json#/$defs/ClipInstanceTarget"
          }
        }
      }
    }
  },
  "publish-package-proposal.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/publish-package-proposal.schema.json",
    "title": "publish_package_proposal_v1",
    "description": "P04-21 (additive v1 note): the publish package the job's selected orchestration model proposes from the brief, the script and the shot plan (or, for a raw video, the transcript) \u2014 KARAR-VIDEO-BRIEF-SCRIPT-PLAN-VE-ONAY \u00a712A, Q43/Q44. Plain title texts with the index of the selected one, the description, the tags, the thumbnail source with its reason and the titles of a long video's chapters. There are no ids, times of chapters, refs, cost or origin here: the server assigns the title ids, derives the chapter times from the script, pins the basis to the exact head revisions, prices the thumbnail and writes the `publish_package_v1` body through the Composition owner port. The thumbnail source is free (`engine_frame` from a scene of the plan, `user_image` from an image the job was shown): a paid AI image is never proposed here. This document is the output contract of the `publish_package` Assistant sub-job.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "titles",
      "selected_title",
      "description",
      "tags",
      "thumbnail"
    ],
    "properties": {
      "schema_version": {
        "const": "publish_package_proposal_v1"
      },
      "titles": {
        "description": "Two to five title options in the package language, the best one at `selected_title`.",
        "type": "array",
        "minItems": 2,
        "maxItems": 5,
        "items": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        }
      },
      "selected_title": {
        "description": "0-based index into `titles`.",
        "type": "integer",
        "minimum": 0,
        "maximum": 4
      },
      "description": {
        "type": "string",
        "minLength": 1,
        "maxLength": 5000
      },
      "tags": {
        "type": "array",
        "maxItems": 30,
        "items": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100,
          "pattern": "^[^,<>]+$"
        }
      },
      "thumbnail": {
        "$ref": "#/$defs/Thumbnail"
      },
      "chapters": {
        "description": "Only for a long video: one entry per script chapter the package lists, in script order (`chapter_id` is the script's own id); the server derives the times.",
        "type": "array",
        "minItems": 3,
        "maxItems": 100,
        "items": {
          "$ref": "#/$defs/Chapter"
        }
      }
    },
    "$defs": {
      "Chapter": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "chapter_id",
          "title"
        ],
        "properties": {
          "chapter_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "Thumbnail": {
        "description": "Q43: the model picks the source for the job. `engine_frame` names a scene of the plan (and the time inside it); `user_image` names one of the images the job was shown by its key (`img1`...). The engine renders either with the title in the project's Video style (free, editable).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source",
          "reason"
        ],
        "properties": {
          "source": {
            "enum": [
              "engine_frame",
              "user_image"
            ]
          },
          "reason": {
            "description": "One sentence the user reads in the plan.",
            "type": "string",
            "minLength": 1,
            "maxLength": 500
          },
          "title_text": {
            "description": "Text drawn on the thumbnail (a few words).",
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "scene_id": {
            "description": "engine_frame: a scene id the package offers.",
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "at_seconds": {
            "description": "engine_frame: seconds from the start of that scene; absent only for the offered hero frame, which carries its own time.",
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "image_key": {
            "description": "user_image: the key of an image the package offers.",
            "type": "string",
            "pattern": "^img[0-9]{1,2}$"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "source": {
                  "const": "engine_frame"
                }
              }
            },
            "then": {
              "required": [
                "scene_id"
              ],
              "not": {
                "required": [
                  "image_key"
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "source": {
                  "const": "user_image"
                }
              }
            },
            "then": {
              "required": [
                "image_key"
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
                      "at_seconds"
                    ]
                  }
                ]
              }
            }
          }
        ]
      }
    }
  },
  "publish-package.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/publish-package.schema.json",
    "title": "publish_package_v1",
    "description": "PublishPackage body (KARAR-VIDEO-BRIEF-SCRIPT-PLAN-VE-ONAY \u00a712A, Q43/Q44; K293): the plan's 'Yay\u0131n paketi' section. Title options with the selected one, description, tags, the thumbnail with its source, reason and cost, and chapter times of a long video. `basis` pins exactly what the package was written from; when the job's script or shot plan head (or the source's transcript revision) moves, the owner reports the bound fields as stale and never rewrites them silently. A package is a proposal for publishing: approving the plan is not a permission to publish (Connector external-effect permission, P03-18/19).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "language",
      "basis",
      "titles",
      "description",
      "tags",
      "thumbnail"
    ],
    "properties": {
      "schema_version": {
        "const": "publish_package_v1"
      },
      "language": {
        "$ref": "common.schema.json#/$defs/Locale"
      },
      "basis": {
        "oneOf": [
          {
            "$ref": "#/$defs/ScriptBasis"
          },
          {
            "$ref": "#/$defs/TranscriptBasis"
          }
        ]
      },
      "titles": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "options",
          "selected_title_id"
        ],
        "properties": {
          "options": {
            "type": "array",
            "minItems": 2,
            "maxItems": 5,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "title_id",
                "text"
              ],
              "properties": {
                "title_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "text": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 100
                }
              }
            }
          },
          "selected_title_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          }
        }
      },
      "description": {
        "type": "string",
        "minLength": 1,
        "maxLength": 5000
      },
      "tags": {
        "type": "array",
        "maxItems": 30,
        "items": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100,
          "pattern": "^[^,<>]+$"
        }
      },
      "thumbnail": {
        "$ref": "#/$defs/Thumbnail"
      },
      "chapters": {
        "description": "Chapter times of a long video. Absent on a short video.",
        "type": "array",
        "minItems": 3,
        "maxItems": 100,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "chapter_id",
            "start_seconds",
            "title"
          ],
          "properties": {
            "chapter_id": {
              "$ref": "common.schema.json#/$defs/StableId"
            },
            "start_seconds": {
              "$ref": "common.schema.json#/$defs/Seconds"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 100
            }
          }
        }
      }
    },
    "$defs": {
      "ScriptBasis": {
        "description": "A plan written from scratch: the exact script revision, and the shot plan revision when one exists.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "script_ref"
        ],
        "properties": {
          "kind": {
            "const": "script"
          },
          "script_ref": {
            "allOf": [
              {
                "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
              },
              {
                "properties": {
                  "artifact_kind": {
                    "const": "script"
                  }
                }
              }
            ]
          },
          "shot_plan_ref": {
            "allOf": [
              {
                "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
              },
              {
                "properties": {
                  "artifact_kind": {
                    "const": "shot_plan"
                  }
                }
              }
            ]
          }
        }
      },
      "TranscriptBasis": {
        "description": "A raw-video plan: the uploaded source and the exact transcript revision the agent read.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "source_id",
          "transcript_ref"
        ],
        "properties": {
          "kind": {
            "const": "transcript"
          },
          "source_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "transcript_ref": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "artifact_id",
              "artifact_revision"
            ],
            "properties": {
              "artifact_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "artifact_revision": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
              }
            }
          }
        }
      },
      "Thumbnail": {
        "description": "Q43: the selected model picks the source for the job. `engine_frame` and `user_image` are rendered by the engine with the title in the project's Video style (free, editable); `ai_image` is a paid plan line. The reason and the cost are visible in the plan.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source",
          "reason",
          "cost"
        ],
        "properties": {
          "source": {
            "enum": [
              "engine_frame",
              "user_image",
              "ai_image"
            ]
          },
          "reason": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500
          },
          "title_text": {
            "description": "Text drawn on the thumbnail.",
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "frame": {
            "description": "engine_frame: the scene and the time inside it.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "scene_id",
              "at_seconds"
            ],
            "properties": {
              "scene_id": {
                "$ref": "common.schema.json#/$defs/StableId"
              },
              "at_seconds": {
                "$ref": "common.schema.json#/$defs/Seconds"
              }
            }
          },
          "image": {
            "description": "user_image: the user's own image.",
            "allOf": [
              {
                "$ref": "common.schema.json#/$defs/OwnerResourceRef"
              },
              {
                "properties": {
                  "owner_bc": {
                    "const": "storage"
                  },
                  "resource_kind": {
                    "const": "asset"
                  }
                }
              }
            ]
          },
          "generation": {
            "description": "ai_image: the real catalog capability and the prompt.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "capability",
              "prompt"
            ],
            "properties": {
              "capability": {
                "$ref": "common.schema.json#/$defs/CapabilityRef"
              },
              "prompt": {
                "type": "string",
                "minLength": 1,
                "maxLength": 2000
              }
            }
          },
          "cost": {
            "description": "free: no credits. priced: the owner's price. not_ready: a paid source without a live price (never shown as 0).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "status"
            ],
            "properties": {
              "status": {
                "enum": [
                  "free",
                  "priced",
                  "not_ready"
                ]
              },
              "credits": {
                "$ref": "common.schema.json#/$defs/Credits"
              }
            },
            "allOf": [
              {
                "if": {
                  "properties": {
                    "status": {
                      "const": "priced"
                    }
                  }
                },
                "then": {
                  "required": [
                    "credits"
                  ],
                  "properties": {
                    "credits": {
                      "exclusiveMinimum": 0
                    }
                  }
                }
              },
              {
                "if": {
                  "properties": {
                    "status": {
                      "enum": [
                        "free",
                        "not_ready"
                      ]
                    }
                  }
                },
                "then": {
                  "not": {
                    "required": [
                      "credits"
                    ]
                  }
                }
              }
            ]
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "source": {
                  "const": "engine_frame"
                }
              }
            },
            "then": {
              "required": [
                "frame"
              ],
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "image"
                    ]
                  },
                  {
                    "required": [
                      "generation"
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
                  "const": "user_image"
                }
              }
            },
            "then": {
              "required": [
                "image"
              ],
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "frame"
                    ]
                  },
                  {
                    "required": [
                      "generation"
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
                  "const": "ai_image"
                }
              }
            },
            "then": {
              "required": [
                "generation"
              ],
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "frame"
                    ]
                  },
                  {
                    "required": [
                      "image"
                    ]
                  }
                ]
              }
            }
          }
        ]
      }
    }
  },
  "research-pack.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/research-pack.schema.json",
    "title": "research_pack_v1",
    "description": "ResearchPack body (KARAR \u00a74, \u00a76): query scope and as-of time; sources with canonical URL, publisher, publish/update/access/event times and the read content ref/hash; claims bound to source locations with supported/contradicted/unknown status. Source pages are untrusted evidence data, never instructions. A pack that was not needed is recorded as coverage.status=not_required with a reason (skipped with justification).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "query_scope",
      "as_of",
      "sources",
      "claims",
      "coverage"
    ],
    "properties": {
      "schema_version": {
        "const": "research_pack_v1"
      },
      "query_scope": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "queries"
        ],
        "properties": {
          "queries": {
            "type": "array",
            "maxItems": 50,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            }
          },
          "scope_note": {
            "type": "string",
            "maxLength": 1000
          }
        }
      },
      "as_of": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "freshness_policy_revision": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
      },
      "revalidate_after": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "sources": {
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "#/$defs/Source"
        }
      },
      "claims": {
        "type": "array",
        "maxItems": 500,
        "items": {
          "$ref": "#/$defs/Claim"
        }
      },
      "coverage": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status"
        ],
        "properties": {
          "status": {
            "enum": [
              "sufficient",
              "insufficient",
              "not_required"
            ]
          },
          "reason": {
            "type": "string",
            "maxLength": 1000
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "status": {
                  "enum": [
                    "insufficient",
                    "not_required"
                  ]
                }
              }
            },
            "then": {
              "required": [
                "reason"
              ]
            }
          }
        ]
      }
    },
    "$defs": {
      "Source": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source_id",
          "canonical_url",
          "publisher",
          "accessed_at",
          "read_status"
        ],
        "properties": {
          "source_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "canonical_url": {
            "type": "string",
            "pattern": "^https?://[^ \\t\\r\\n]+$",
            "maxLength": 2048
          },
          "publisher": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "title": {
            "type": "string",
            "maxLength": 500
          },
          "published_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "updated_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "accessed_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "event_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "read_status": {
            "description": "snippet_only is discovery, not a read; unreadable/paywalled sources are never counted as read (\u00a76.5).",
            "enum": [
              "read",
              "snippet_only",
              "unreadable",
              "paywalled"
            ]
          },
          "content_ref": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "sha256"
            ],
            "properties": {
              "storage_object_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "sha256": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              }
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "read_status": {
                  "const": "read"
                }
              }
            },
            "then": {
              "required": [
                "content_ref"
              ]
            }
          }
        ]
      },
      "Claim": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "claim_id",
          "text",
          "claim_type",
          "support",
          "evidence"
        ],
        "properties": {
          "claim_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "claim_type": {
            "description": "Measured fact, news report, interpretation and social discourse are separate claim types (\u00a76.3).",
            "enum": [
              "measured_fact",
              "news_report",
              "interpretation",
              "social_discourse",
              "historical_fact",
              "definition"
            ]
          },
          "support": {
            "enum": [
              "supported",
              "contradicted",
              "unknown"
            ]
          },
          "evidence": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "source_id",
                "stance"
              ],
              "properties": {
                "source_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "locator": {
                  "type": "string",
                  "maxLength": 500
                },
                "stance": {
                  "enum": [
                    "supports",
                    "contradicts"
                  ]
                }
              }
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "support": {
                  "const": "supported"
                }
              }
            },
            "then": {
              "properties": {
                "evidence": {
                  "minItems": 1
                }
              }
            }
          }
        ]
      }
    }
  },
  "script-artifact.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/script-artifact.schema.json",
    "title": "script_artifact_v1",
    "description": "ScriptArtifact body (KARAR \u00a74, \u00a712A, 3B): stable chapter/beat ids, title/angle/hook options, purpose/key message/narrative flow, the FULL narration of every beat, estimated seconds/words and pauses, on-screen texts (quoted screen texts are bound to beats for Motion Film) and claim refs. result_kind=outline can never be ready (K210). A disabled optional chapter keeps its text but does not count toward narration/timing (8C).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "result_kind",
      "title",
      "language",
      "angle",
      "hook",
      "purpose",
      "key_message",
      "narrative_flow",
      "chapters",
      "totals"
    ],
    "properties": {
      "schema_version": {
        "const": "script_artifact_v1"
      },
      "result_kind": {
        "enum": [
          "full",
          "outline"
        ]
      },
      "narration_mode": {
        "description": "P04-20 (additive v1 note): `spoken` (the default when absent) = every beat of a full script carries the narration to be spoken. `none` = a screen-text film (the Motion Film default: no voice-over): a full script keeps every beat's narration empty and every beat carries at least one on-screen text instead; the copy is rendered exactly as quoted.",
        "enum": [
          "spoken",
          "none"
        ]
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "language": {
        "$ref": "common.schema.json#/$defs/Locale"
      },
      "angle": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "hook": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "options",
          "selected_hook_id"
        ],
        "properties": {
          "options": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "hook_id",
                "text"
              ],
              "properties": {
                "hook_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "text": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1000
                }
              }
            }
          },
          "selected_hook_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          }
        }
      },
      "purpose": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "key_message": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "narrative_flow": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "brief_ref": {
        "$ref": "#/$defs/BriefRef"
      },
      "research_ref": {
        "$ref": "#/$defs/ResearchRef"
      },
      "chapters": {
        "type": "array",
        "minItems": 1,
        "maxItems": 60,
        "items": {
          "$ref": "#/$defs/Chapter"
        }
      },
      "totals": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "estimated_seconds",
          "word_count",
          "speech_rate_wpm",
          "rate_basis"
        ],
        "properties": {
          "estimated_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "word_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 200000
          },
          "speech_rate_wpm": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 400
          },
          "rate_basis": {
            "description": "No fixed '10 min = X words' promise: the tempo is measured for the voice or an explicit assumption (\u00a77).",
            "enum": [
              "measured",
              "assumed"
            ]
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "result_kind": {
              "const": "full"
            },
            "narration_mode": {
              "const": "none"
            }
          },
          "required": [
            "result_kind",
            "narration_mode"
          ]
        },
        "then": {
          "properties": {
            "chapters": {
              "items": {
                "properties": {
                  "beats": {
                    "items": {
                      "properties": {
                        "on_screen_texts": {
                          "minItems": 1
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "else": {
          "if": {
            "properties": {
              "result_kind": {
                "const": "full"
              }
            }
          },
          "then": {
            "properties": {
              "chapters": {
                "items": {
                  "properties": {
                    "beats": {
                      "items": {
                        "properties": {
                          "narration": {
                            "minLength": 1
                          }
                        }
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
      "BriefRef": {
        "allOf": [
          {
            "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "video_brief"
              }
            }
          }
        ]
      },
      "ResearchRef": {
        "allOf": [
          {
            "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "research_pack"
              }
            }
          }
        ]
      },
      "Chapter": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "chapter_id",
          "title",
          "section_role",
          "enabled",
          "estimated_seconds",
          "beats"
        ],
        "properties": {
          "chapter_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "section_role": {
            "$ref": "common.schema.json#/$defs/SectionRole"
          },
          "enabled": {
            "type": "boolean"
          },
          "target_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "estimated_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "beats": {
            "type": "array",
            "minItems": 1,
            "maxItems": 200,
            "items": {
              "$ref": "#/$defs/Beat"
            }
          }
        }
      },
      "Beat": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "beat_id",
          "narration",
          "on_screen_texts",
          "claim_refs",
          "estimated_seconds",
          "word_count"
        ],
        "properties": {
          "beat_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "narration": {
            "description": "The exact text to be spoken (full script). Empty only in an outline, or in a full script whose narration_mode is `none` (a screen-text film: the beat's on-screen texts carry the copy).",
            "type": "string",
            "maxLength": 20000
          },
          "summary": {
            "type": "string",
            "maxLength": 1000
          },
          "on_screen_texts": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "text_id",
                "text",
                "quoted"
              ],
              "properties": {
                "text_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "text": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 500
                },
                "quoted": {
                  "description": "Motion Film quoted screen text bound to this beat (P04-20).",
                  "type": "boolean"
                }
              }
            }
          },
          "claim_refs": {
            "type": "array",
            "maxItems": 20,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/StableId"
            }
          },
          "estimated_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "word_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 5000
          },
          "pause_after_ms": {
            "type": "integer",
            "minimum": 0,
            "maximum": 10000
          }
        }
      }
    }
  },
  "shot-plan-proposal.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/shot-plan-proposal.schema.json",
    "title": "shot_plan_proposal_v1",
    "description": "SV (additive v1 note): the shot plan the job's selected orchestration model proposes for a narrated short video from the job's full script \u2014 FAZ-04 P04-03/P04-16/P04-19, KARAR-VIDEO-BRIEF-SCRIPT-PLAN-VE-ONAY \u00a74. The model decides the shot structure and what the viewer must see: per shot the script beats it covers, its purpose, and the typed visual intent (function, factuality, entities, motion need, what it shows in words; a camera move over a still is `needs_motion: camera`). It never names a source, a model, a price, a prompt, a duration, an id or a path: the server derives the shot ids and the planned seconds from the beats, hands the intents to the director resolver (typed scene, Brand Motion, the user's own media, platform Stock, catalogue AI image/video with the Workflow quote) and writes the `shot_plan_v1` body through the Composition owner port. This document is the output contract of the `shot_plan` Assistant sub-job.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "shots"
    ],
    "properties": {
      "schema_version": {
        "const": "shot_plan_proposal_v1"
      },
      "shots": {
        "description": "The shots in film order. Every beat of every enabled chapter appears in exactly one shot; a shot covers consecutive beats of one chapter.",
        "type": "array",
        "minItems": 1,
        "maxItems": 60,
        "items": {
          "$ref": "#/$defs/Shot"
        }
      }
    },
    "$defs": {
      "Shot": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "beat_ids",
          "purpose",
          "intent"
        ],
        "properties": {
          "beat_ids": {
            "description": "The script beats this shot covers, in script order (the script's own beat ids).",
            "type": "array",
            "minItems": 1,
            "maxItems": 16,
            "items": {
              "$ref": "common.schema.json#/$defs/StableId"
            }
          },
          "purpose": {
            "description": "What the shot does for the story; the plan card shows it next to the shot.",
            "enum": [
              "hook",
              "context",
              "explain",
              "evidence",
              "demo",
              "emphasis",
              "recap",
              "cta"
            ]
          },
          "intent": {
            "$ref": "#/$defs/Intent"
          }
        }
      },
      "Intent": {
        "description": "The director's typed visual intent of one shot (the `VisualIntent` of shot_plan_v1 without the fields the server owns: the length and an explicit route).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "function",
          "factuality",
          "needs_motion",
          "description"
        ],
        "properties": {
          "function": {
            "enum": [
              "narrate",
              "data",
              "place_route",
              "evidence",
              "atmosphere",
              "transition",
              "emphasis",
              "speaker"
            ]
          },
          "factuality": {
            "description": "documentary = a real record is shown; illustrative = a clearly styled depiction; symbolic = an abstract visual.",
            "enum": [
              "documentary",
              "illustrative",
              "symbolic"
            ]
          },
          "entities": {
            "type": "array",
            "maxItems": 10,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "name",
                "kind",
                "real"
              ],
              "properties": {
                "name": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 120
                },
                "kind": {
                  "enum": [
                    "person",
                    "event",
                    "place",
                    "organization",
                    "product",
                    "concept"
                  ]
                },
                "real": {
                  "type": "boolean"
                }
              }
            }
          },
          "needs_motion": {
            "description": "none = a still is enough; camera = a camera move over a still; subject = the subject itself must move.",
            "enum": [
              "none",
              "camera",
              "subject"
            ]
          },
          "description": {
            "description": "What the viewer sees, in words (the Stock semantic search and the generation prompt start from it). No model name, no price.",
            "type": "string",
            "minLength": 1,
            "maxLength": 500
          }
        }
      }
    }
  },
  "shot-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/shot-plan.schema.json",
    "title": "shot_plan_v1",
    "description": "ShotPlan body (KARAR \u00a74, 8D; Motion Film \u00a74.3): script beat -> shot mapping on one exact ScriptArtifact revision, visual intent, asset reuse or generation path with real catalog capability refs, planned/generated/usable seconds, transition/continuity, voice/caption relation, required/optional slots and intro/outro section role, avatar/voice bindings. Motion Film shots carry typed MotionShotSpec and SlotMediaRequest (P00-13 motion-spark) plus the MotionStoryboard and AssetInventoryItem list; there is no second plan authority. Counters (shots, new outputs, reused assets, generated seconds) are derived by the server, never stored here. P04-03 (additive v1 note) adds the F21 model: Sections, Scenes (stable scene_id + narration binding + typed scene/layer/animation content), PlannedShot timing/handles/references/dependencies/retry limit and its 0..n GenerationShots, and the narration voicing.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "script_ref",
      "shots"
    ],
    "properties": {
      "schema_version": {
        "const": "shot_plan_v1"
      },
      "script_ref": {
        "allOf": [
          {
            "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "script"
              }
            }
          }
        ]
      },
      "brief_ref": {
        "description": "P04-22 (additive v1 note): the exact VideoBrief revision a Motion Film plan was planned from. The plan validator reads that brief (truth sources, kind, ratio) and a newer brief revision reads the plan as stale; a plan without it validates exactly as before.",
        "allOf": [
          {
            "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "video_brief"
              }
            }
          }
        ]
      },
      "shots": {
        "type": "array",
        "minItems": 1,
        "maxItems": 500,
        "items": {
          "$ref": "#/$defs/Shot"
        }
      },
      "motion_storyboard": {
        "$ref": "#/$defs/MotionStoryboard"
      },
      "asset_inventory": {
        "type": "array",
        "maxItems": 100,
        "items": {
          "$ref": "#/$defs/AssetInventoryItem"
        }
      },
      "sections": {
        "description": "P04-03 (additive v1 note) F21 Sections: a script chapter is one Section by default. Absent = derived 1:1 from the script chapters (section_id = chapter_id).",
        "type": "array",
        "maxItems": 60,
        "items": {
          "$ref": "#/$defs/Section"
        }
      },
      "scenes": {
        "description": "P04-03 (additive v1 note) F21 Scenes: the units that materialize in the Spark scene strip with a stable scene_id and a narration binding (ScriptArtifact revision + beat ids). Absent = derived one Scene per enabled beat (preparation-rules.json derivation_rules).",
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "#/$defs/Scene"
        }
      },
      "narration": {
        "$ref": "#/$defs/Narration"
      },
      "production_mode": {
        "description": "SV (additive v1 note): `storyboard_draft` = the plan the user asked to see first (QA-369): every shot is a still with a camera move, no generated video and no voice-over cost; the full production is planned again after the user's decision. Absent = the full production at the profile the user chose.",
        "enum": [
          "storyboard_draft"
        ]
      },
      "audio_intents": {
        "description": "P04-19 (additive v1 note R12-4): the director's typed AudioIntents (SFX/music) with their resolved source (own media -> platform Stock -> Stock'ta Olu\u015ftur).",
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "#/$defs/AudioIntentEntry"
        }
      }
    },
    "$defs": {
      "VisualIntent": {
        "description": "P04-19 (additive v1 note R12-4) typed director intent of one beat or cue (KARAR-SPARK-SAHNE \u00a74A): what the viewer must see and why, never a model id, price or licence (the resolver picks a real catalogue source).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "function",
          "factuality",
          "needs_motion",
          "target_seconds",
          "description"
        ],
        "properties": {
          "function": {
            "enum": [
              "narrate",
              "data",
              "place_route",
              "evidence",
              "atmosphere",
              "transition",
              "emphasis",
              "speaker"
            ]
          },
          "factuality": {
            "description": "documentary = a real record is shown; illustrative = a clearly styled depiction; symbolic = an abstract visual.",
            "enum": [
              "documentary",
              "illustrative",
              "symbolic"
            ]
          },
          "entities": {
            "type": "array",
            "maxItems": 10,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "name",
                "kind",
                "real"
              ],
              "properties": {
                "name": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 120
                },
                "kind": {
                  "enum": [
                    "person",
                    "event",
                    "place",
                    "organization",
                    "product",
                    "concept"
                  ]
                },
                "real": {
                  "description": "A real person/event/place (Q26: never shown as a photoreal fake record by the director).",
                  "type": "boolean"
                }
              }
            }
          },
          "needs_motion": {
            "description": "none = a still is enough; camera = a camera move over a still; subject = the subject itself must move.",
            "enum": [
              "none",
              "camera",
              "subject"
            ]
          },
          "target_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "continuity_ref": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "description": {
            "description": "The need in words (the Stock semantic search and the generation prompt start from it).",
            "type": "string",
            "minLength": 1,
            "maxLength": 500
          },
          "explicit_request": {
            "description": "The user explicitly asked for this route in this job (e.g. 'stok de\u011fil, g\u00f6rsel \u00fcret', or a photoreal scene of a real event under the user's responsibility, Q26).",
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "modality": {
                "$ref": "#/$defs/SourceModality"
              },
              "photoreal": {
                "type": "boolean"
              }
            }
          }
        }
      },
      "AudioIntent": {
        "description": "P04-19 (additive v1 note R12-4) typed audio need (KARAR-MOTION-FILM \u00a710): SFX or music, taxonomy category, the need in words, the length to fill; never an id, licence or price.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "role",
          "description",
          "required"
        ],
        "properties": {
          "role": {
            "enum": [
              "sfx",
              "music"
            ]
          },
          "category": {
            "type": "string",
            "pattern": "^[a-z0-9_-]{1,64}$"
          },
          "description": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500
          },
          "target_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "required": {
            "description": "A required element stops the plan when no source exists (kaynak gerekli); an optional one is omitted.",
            "type": "boolean"
          }
        }
      },
      "SourceModality": {
        "description": "P04-19 source kinds the modality resolver chooses between (plus omitted/none when no allowed source exists).",
        "enum": [
          "typed_scene",
          "brand_motion",
          "own_media",
          "youtorch_stock",
          "ai_image",
          "llm_motion",
          "ai_video",
          "stock_create",
          "omitted",
          "none"
        ]
      },
      "SourceSelection": {
        "description": "P04-19 (additive v1 note R12-4) the resolver's pinned choice (the plan row's Kaynak chip): modality + source/model revision + rule ref + reason + cost. Written by the server resolver, never invented by the LLM.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "modality",
          "selection_source",
          "reason",
          "resolver_revision",
          "cost"
        ],
        "properties": {
          "modality": {
            "$ref": "#/$defs/SourceModality"
          },
          "source_ref": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "model_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/ModelId"
          },
          "camera_preset": {
            "enum": [
              "ken_burns_in",
              "ken_burns_out",
              "pan_left",
              "pan_right"
            ]
          },
          "profile": {
            "$ref": "common.schema.json#/$defs/QualityTier"
          },
          "selection_source": {
            "$ref": "common.schema.json#/$defs/SelectionSource"
          },
          "rule_ref": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "reason": {
            "type": "string",
            "pattern": "^[a-z0-9_]{1,64}$"
          },
          "resolver_revision": {
            "type": "string",
            "pattern": "^modality-resolver-v[0-9]+$"
          },
          "responsibility": {
            "description": "Q26: set only when the user explicitly asked for a photoreal depiction of a real person/event.",
            "const": "user"
          },
          "cost": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "status"
            ],
            "properties": {
              "status": {
                "enum": [
                  "free",
                  "priced",
                  "not_ready"
                ]
              },
              "credits": {
                "$ref": "common.schema.json#/$defs/Credits"
              }
            }
          }
        }
      },
      "ShotDirection": {
        "description": "P04-19 (additive v1 note R12-4): the shot's typed VisualIntent and (after the resolver ran) its pinned SourceSelection.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "intent"
        ],
        "properties": {
          "intent": {
            "$ref": "#/$defs/VisualIntent"
          },
          "selection": {
            "$ref": "#/$defs/SourceSelection"
          }
        }
      },
      "AudioIntentEntry": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "audio_intent_id",
          "intent"
        ],
        "properties": {
          "audio_intent_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "scene_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "beat_ids": {
            "type": "array",
            "maxItems": 64,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/StableId"
            }
          },
          "intent": {
            "$ref": "#/$defs/AudioIntent"
          },
          "selection": {
            "$ref": "#/$defs/SourceSelection"
          }
        }
      },
      "Section": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "section_id",
          "chapter_id"
        ],
        "properties": {
          "section_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "chapter_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        }
      },
      "Scene": {
        "description": "One Scene of the plan. Its narration is the exact text of its beats in the pinned script revision (never copied here). `content` is a typed scene/layer/animation proposal (Q16): text layers reference script on-screen texts, media layers reference a PlannedShot, animations name presets of the Composition scene-preset allowlist. There is no free HTML/CSS/JS field; code scenes are the separate isolated Motion path.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scene_id",
          "order",
          "section_id",
          "beat_ids",
          "timing_policy"
        ],
        "properties": {
          "scene_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "order": {
            "type": "integer",
            "minimum": 1,
            "maximum": 500
          },
          "section_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "beat_ids": {
            "type": "array",
            "minItems": 1,
            "maxItems": 64,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/StableId"
            }
          },
          "timing_policy": {
            "description": "Target Composition timing policy. Before the real TTS the materialized scene is fixed at the estimated length; follow_narration applies once the narration placement exists (P04-07).",
            "enum": [
              "fixed",
              "follow_media",
              "follow_narration"
            ]
          },
          "content": {
            "$ref": "#/$defs/SceneContent"
          }
        }
      },
      "SceneContent": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "layers"
        ],
        "properties": {
          "layers": {
            "type": "array",
            "maxItems": 60,
            "items": {
              "$ref": "#/$defs/SceneLayer"
            }
          }
        }
      },
      "SceneLayer": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "layer_key",
          "kind",
          "role"
        ],
        "properties": {
          "layer_key": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "kind": {
            "enum": [
              "text",
              "media"
            ]
          },
          "role": {
            "enum": [
              "title",
              "body",
              "media"
            ]
          },
          "text_ref": {
            "description": "The script on-screen text this text layer shows (the ScriptArtifact stays the text authority).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "beat_id",
              "text_id"
            ],
            "properties": {
              "beat_id": {
                "$ref": "common.schema.json#/$defs/StableId"
              },
              "text_id": {
                "$ref": "common.schema.json#/$defs/StableId"
              }
            }
          },
          "shot_id": {
            "description": "The PlannedShot whose clip fills this media layer (the F21 ClipInstance target).",
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "window": {
            "description": "Scene-relative window; absent = the whole scene.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "start_seconds",
              "end_seconds"
            ],
            "properties": {
              "start_seconds": {
                "$ref": "common.schema.json#/$defs/Seconds"
              },
              "end_seconds": {
                "$ref": "common.schema.json#/$defs/Seconds"
              }
            }
          },
          "animations": {
            "type": "array",
            "maxItems": 6,
            "items": {
              "$ref": "#/$defs/SceneAnimation"
            }
          }
        },
        "allOf": [
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
                "text_ref"
              ],
              "not": {
                "required": [
                  "shot_id"
                ]
              },
              "properties": {
                "role": {
                  "enum": [
                    "title",
                    "body"
                  ]
                }
              }
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
                "shot_id"
              ],
              "not": {
                "required": [
                  "text_ref"
                ]
              },
              "properties": {
                "role": {
                  "const": "media"
                }
              }
            }
          }
        ]
      },
      "SceneAnimation": {
        "description": "Typed enter/exit/emphasis preset (SAHNE \u00a73 AnimationSpec). enter anchors at the layer window start, exit ends at the window end, emphasis starts at the window start. The preset must be in the Composition scene-preset allowlist (validated by the server, not by this schema).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "phase",
          "preset_id",
          "preset_revision",
          "duration_seconds",
          "easing"
        ],
        "properties": {
          "phase": {
            "enum": [
              "enter",
              "exit",
              "emphasis"
            ]
          },
          "preset_id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,47}$"
          },
          "preset_revision": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1000
          },
          "duration_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 10
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
          }
        }
      },
      "GenerationShot": {
        "description": "F21 GenerationShot: one paid provider generation intent of a PlannedShot (0..n; 0 when the shot reuses an asset). A clip-length limit is split into parts here, never into new story shots (8F). depends_on names other generation shots whose output this one consumes (e.g. image -> image-to-video).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "generation_shot_id",
          "output_kind",
          "capability",
          "generated_seconds"
        ],
        "properties": {
          "generation_shot_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "output_kind": {
            "enum": [
              "image",
              "video",
              "audio",
              "avatar_video"
            ]
          },
          "capability": {
            "$ref": "common.schema.json#/$defs/CapabilityRef"
          },
          "quality": {
            "$ref": "common.schema.json#/$defs/QualityTier"
          },
          "generated_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "usable_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "part_index": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50
          },
          "reference_set": {
            "type": "array",
            "maxItems": 10,
            "items": {
              "$ref": "common.schema.json#/$defs/OwnerResourceRef"
            }
          },
          "depends_on": {
            "type": "array",
            "maxItems": 10,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/StableId"
            }
          },
          "retry_limit": {
            "description": "Automatic repair attempts of this generation (P04-09 caps at the plan's repair_attempts_max).",
            "type": "integer",
            "minimum": 0,
            "maximum": 5
          },
          "prompt": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          }
        }
      },
      "Narration": {
        "description": "P04-03 (additive v1 note): how the script narration is voiced. tts = one speech operation per Scene from the exact beat narration (paid, after G1 only); none = no narration audio (e.g. Motion Film default).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "mode"
        ],
        "properties": {
          "mode": {
            "enum": [
              "tts",
              "none"
            ]
          },
          "capability": {
            "$ref": "common.schema.json#/$defs/CapabilityRef"
          },
          "voice": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "retry_limit": {
            "type": "integer",
            "minimum": 0,
            "maximum": 5
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "mode": {
                  "const": "tts"
                }
              }
            },
            "then": {
              "required": [
                "capability"
              ]
            }
          }
        ]
      },
      "Shot": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "shot_id",
          "order",
          "chapter_id",
          "beat_ids",
          "section_role",
          "visual_intent",
          "media_path",
          "planned_seconds",
          "slot_kind"
        ],
        "properties": {
          "shot_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "order": {
            "type": "integer",
            "minimum": 1,
            "maximum": 500
          },
          "chapter_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "beat_ids": {
            "type": "array",
            "minItems": 1,
            "maxItems": 64,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/StableId"
            }
          },
          "section_role": {
            "$ref": "common.schema.json#/$defs/SectionRole"
          },
          "visual_intent": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          },
          "media_path": {
            "description": "native = editor text/shape/chart; existing_asset/stock reuse an asset (not a new generation); generate/avatar/motion need a real catalog capability.",
            "enum": [
              "native",
              "existing_asset",
              "stock",
              "generate",
              "avatar",
              "motion"
            ]
          },
          "asset_refs": {
            "type": "array",
            "maxItems": 10,
            "items": {
              "$ref": "common.schema.json#/$defs/OwnerResourceRef"
            }
          },
          "capability": {
            "$ref": "common.schema.json#/$defs/CapabilityRef"
          },
          "output_kind": {
            "description": "What a generation produces (counted separately from shots and reuse, K220).",
            "enum": [
              "image",
              "video",
              "audio",
              "avatar_video"
            ]
          },
          "planned_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "generated_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "usable_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "generation_parts": {
            "description": "Provider parts a clip-length limit requires; a shot is not split into new story shots silently (8F).",
            "type": "integer",
            "minimum": 1,
            "maximum": 50
          },
          "transition_in": {
            "enum": [
              "cut",
              "fade",
              "dissolve",
              "wipe",
              "match_cut",
              "none"
            ]
          },
          "continuity_from_shot_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "caption": {
            "type": "boolean"
          },
          "voice_binding": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "avatar_binding": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "slot_kind": {
            "enum": [
              "required",
              "optional"
            ]
          },
          "prompt_detail": {
            "description": "Secondary technical prompt; shown collapsed (8A).",
            "type": "string",
            "maxLength": 4000
          },
          "motion": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "shot_spec"
            ],
            "properties": {
              "shot_spec": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/motion-shot-spec.schema.json"
              },
              "slot_media_requests": {
                "type": "array",
                "maxItems": 20,
                "items": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/slot-media-request.schema.json"
                }
              }
            }
          },
          "scene_id": {
            "description": "P04-03 (additive v1 note): the Scene this PlannedShot is a clip/layer of. Absent = the scene of its first beat.",
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "generation_shots": {
            "description": "P04-03 (additive v1 note) F21: the 0..n GenerationShots of this PlannedShot. Absent on a generate/avatar shot = derived from capability/output_kind/generated_seconds/generation_parts (preparation-rules.json derivation_rules). A reuse path (native/existing_asset/stock/motion) never has one.",
            "type": "array",
            "maxItems": 20,
            "items": {
              "$ref": "#/$defs/GenerationShot"
            }
          },
          "transition_handles": {
            "$ref": "common.schema.json#/$defs/TransitionHandles"
          },
          "narrator_timing": {
            "$ref": "common.schema.json#/$defs/NarratorTiming"
          },
          "reference_set": {
            "description": "P04-03 (additive v1 note): owner references every generation of this shot uses (identity/product/style). A generation shot's own reference_set replaces it.",
            "type": "array",
            "maxItems": 10,
            "items": {
              "$ref": "common.schema.json#/$defs/OwnerResourceRef"
            }
          },
          "depends_on_shot_ids": {
            "description": "P04-03 (additive v1 note): shots whose result this shot needs first (e.g. continuity from the last frame).",
            "type": "array",
            "maxItems": 10,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/StableId"
            }
          },
          "retry_limit": {
            "description": "P04-03 (additive v1 note): default automatic repair attempts of this shot's generations.",
            "type": "integer",
            "minimum": 0,
            "maximum": 5
          },
          "quality": {
            "$ref": "common.schema.json#/$defs/QualityTier"
          },
          "direction": {
            "$ref": "#/$defs/ShotDirection"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "media_path": {
                  "enum": [
                    "generate",
                    "avatar"
                  ]
                }
              }
            },
            "then": {
              "required": [
                "capability",
                "output_kind",
                "generated_seconds"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "media_path": {
                  "enum": [
                    "existing_asset",
                    "stock"
                  ]
                }
              }
            },
            "then": {
              "required": [
                "asset_refs"
              ],
              "properties": {
                "asset_refs": {
                  "minItems": 1
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "media_path": {
                  "const": "motion"
                }
              }
            },
            "then": {
              "required": [
                "motion"
              ]
            }
          }
        ]
      },
      "MotionStoryboard": {
        "description": "Motion Film storyboard (\u00a74.3): message, arc (StoryBeats), scene roles; typed field of the one ShotPlan. P04-20 (additive v1 note) adds the audience, the energy curve, the direction block (written once for all scenes) and, per scene, the persuasion, story beat, focal point, element roles and the quoted on-screen texts the scene shows.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "message",
          "arc",
          "scene_roles"
        ],
        "properties": {
          "message": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500
          },
          "arc": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/story-beats.schema.json"
          },
          "audience": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500
          },
          "video_style": {
            "description": "P04-20: the Video style the film was planned and previewed with: the exact preset revision and the sha256 of the resolved style snapshot (the compiler pins it; another snapshot is another film).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "preset_ref",
              "style_sha256"
            ],
            "properties": {
              "preset_ref": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/SemverRevisionRef"
              },
              "style_sha256": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              }
            }
          },
          "energy_curve": {
            "description": "P04-20: the energy of every scene in film order (Sakin / Dengeli / Canl\u0131); a film keeps at least one calm breathing scene (doctrine 7).",
            "type": "array",
            "maxItems": 100,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "shot_id",
                "energy"
              ],
              "properties": {
                "shot_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "energy": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/Energy"
                }
              }
            }
          },
          "direction_block": {
            "description": "P04-20: the management block written once for the whole film (KARAR-MOTION-FILM \u00a74.3): the VideoStyle colour roles the film uses, the motion grammar, the reveal model, the breathing scene and the prohibited list.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "palette_roles",
              "motion_grammar",
              "reveal_model",
              "breath_shot_id",
              "prohibited"
            ],
            "properties": {
              "palette_roles": {
                "type": "array",
                "minItems": 1,
                "maxItems": 7,
                "uniqueItems": true,
                "items": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/ColorRoleToken"
                }
              },
              "motion_grammar": {
                "type": "string",
                "minLength": 1,
                "maxLength": 500
              },
              "reveal_model": {
                "type": "string",
                "minLength": 1,
                "maxLength": 500
              },
              "breath_shot_id": {
                "$ref": "common.schema.json#/$defs/StableId"
              },
              "prohibited": {
                "type": "array",
                "maxItems": 20,
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 200
                }
              }
            }
          },
          "scene_roles": {
            "type": "array",
            "maxItems": 100,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "shot_id",
                "role"
              ],
              "properties": {
                "shot_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "role": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]{0,47}$"
                },
                "persuasion": {
                  "description": "P04-20: why this scene persuades (one line).",
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                },
                "beat": {
                  "description": "P04-20: the story beat (arc) this scene belongs to.",
                  "enum": [
                    "hook",
                    "reveal",
                    "feature_loop",
                    "proof",
                    "breather",
                    "cta"
                  ]
                },
                "focal": {
                  "description": "P04-20: what the viewer looks at in this scene, in words.",
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 200
                },
                "roles": {
                  "description": "P04-20: which slots of the scene's pattern are the focus, the support and the background.",
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "focus": {
                      "type": "array",
                      "maxItems": 8,
                      "uniqueItems": true,
                      "items": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 64
                      }
                    },
                    "support": {
                      "type": "array",
                      "maxItems": 8,
                      "uniqueItems": true,
                      "items": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 64
                      }
                    },
                    "background": {
                      "type": "array",
                      "maxItems": 8,
                      "uniqueItems": true,
                      "items": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 64
                      }
                    }
                  }
                },
                "text_ids": {
                  "description": "P04-20: the quoted on-screen texts of the pinned script this scene shows (rendered exactly; the compiler never rewrites them).",
                  "type": "array",
                  "maxItems": 20,
                  "uniqueItems": true,
                  "items": {
                    "$ref": "common.schema.json#/$defs/StableId"
                  }
                }
              }
            }
          }
        }
      },
      "AssetInventoryItem": {
        "description": "A user-supplied visual the orchestration model inspected for this job (P04-20): kind, title, feature match, focus boxes, colours, usage and quality/sensitive-data warnings. P04-20 (additive v1 note) adds `source` (who wrote the item: the model that saw the image, the user's own short label, or the user's correction, which is authoritative) and `screen_form` (the device class of a screenshot). P04-22 (additive v1 note) adds `ui_score` (0-8) and the resulting `screen_treatment` (real / simplify / redraw) with its source.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "asset",
          "kind",
          "title",
          "usage"
        ],
        "properties": {
          "asset": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "kind": {
            "enum": [
              "screenshot",
              "photo",
              "logo",
              "product_image",
              "illustration",
              "chart",
              "video",
              "other"
            ]
          },
          "source": {
            "description": "P04-20: `model_vision` = the selected orchestration model saw the image; `user_label` = written from the user's own short label when the model cannot see images (no silent model change, K268); `user_correction` = the user corrected the item, which is the authority from then on.",
            "enum": [
              "model_vision",
              "user_label",
              "user_correction"
            ]
          },
          "screen_form": {
            "description": "P04-20: device class of a screenshot; picks the device frame of the showcase patterns.",
            "enum": [
              "phone",
              "desktop",
              "web"
            ]
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "feature_match": {
            "type": "string",
            "maxLength": 500
          },
          "focus_boxes": {
            "type": "array",
            "maxItems": 10,
            "items": {
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
          },
          "colors": {
            "type": "array",
            "maxItems": 10,
            "items": {
              "type": "string",
              "pattern": "^#[0-9A-Fa-f]{6}$"
            }
          },
          "usage": {
            "enum": [
              "hero",
              "detail",
              "background",
              "reference_only",
              "do_not_use"
            ]
          },
          "quality_warning": {
            "type": "string",
            "maxLength": 500
          },
          "sensitive_data_warning": {
            "type": "string",
            "maxLength": 500
          },
          "ui_score": {
            "$ref": "#/$defs/UiScore"
          },
          "screen_treatment": {
            "description": "P04-22: what the plan does with this screen. `real` = the screenshot enters the device slot as it is; `simplify` = crop to the focus box, hide the sensitive area, redraw the main panel with the UI kit on top; `redraw` = the UI kit represents the product's real function (never an AI mockup). Absent = `real`. Derived from `ui_score.total` (7-8 real, 4-6 simplify, 0-3 redraw) unless the user chose.",
            "enum": [
              "real",
              "simplify",
              "redraw"
            ]
          },
          "screen_treatment_source": {
            "description": "P04-22: `score` = derived from the ui_score by the server; `user` = the user chose (\"use the real screen\" is one click): the user's choice is the authority until they change it.",
            "enum": [
              "score",
              "user"
            ]
          }
        }
      },
      "UiScore": {
        "description": "P04-22 (KARAR-PREMIUM-MOTION \u00a78.1): the interface screenshot score. Four criteria of 0-2 points each: is it current, is it simple, does it fit the brand, does it show the proof moment. The model writes the four criteria, the server writes the total.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "current",
          "simple",
          "on_brand",
          "shows_proof",
          "total"
        ],
        "properties": {
          "current": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2
          },
          "simple": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2
          },
          "on_brand": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2
          },
          "shows_proof": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2
          },
          "total": {
            "type": "integer",
            "minimum": 0,
            "maximum": 8
          }
        }
      }
    }
  },
  "video-brief.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/video-brief.schema.json",
    "title": "video_brief_v1",
    "description": "VideoBrief body (KARAR-VIDEO-BRIEF-SCRIPT-PLAN-VE-ONAY \u00a74): goal, topic, audience, locale, target duration, ratio, output goal, freshness window, explicit constraints, visible assumptions with provenance and source/brand/voice/model preferences. Stored as an immutable Composition preparation artifact revision.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "kind",
      "goal",
      "topic",
      "audience",
      "locale",
      "target_duration_seconds",
      "aspect_ratio",
      "output_goal",
      "freshness",
      "constraints",
      "assumptions"
    ],
    "properties": {
      "schema_version": {
        "const": "video_brief_v1"
      },
      "kind": {
        "description": "Method family of the job (P01D-15 routing). Motion Film kinds and presentation kinds follow motion-spark canonical-enums.json; general/news/historical/short/edit are the KARAR \u00a76/\u00a77 methods.",
        "enum": [
          "general",
          "news_explainer",
          "historical_explainer",
          "short_video",
          "edit_existing",
          "product_intro",
          "launch",
          "feature",
          "ad_story",
          "brand_sting",
          "product_film",
          "presentation",
          "lecture_slides"
        ]
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "goal": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "topic": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "audience": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "locale": {
        "$ref": "common.schema.json#/$defs/Locale"
      },
      "target_duration_seconds": {
        "type": "number",
        "exclusiveMinimum": 0,
        "maximum": 36000
      },
      "aspect_ratio": {
        "$ref": "common.schema.json#/$defs/AspectRatio"
      },
      "format": {
        "description": "P04-01 (additive v1 note): the explicit video format the server resolved from the request (short vertical or long form); absent = not asked. Routes the stage guides (P01D-15); the word 'video' alone never means short_vertical.",
        "enum": [
          "short_vertical",
          "long_form"
        ]
      },
      "loop": {
        "description": "P06-66 (additive v1 note): the video is a seamless loop (web hero, booth screen, social loop); true only on the user's explicit request, absent = not a loop. Only loop_capable motion patterns are candidates, the last rendered frame is N-1 (TK-26), narration defaults off with a warning, music is a loopable track cut on a bar or none, and there is no end card (KARAR-PREMIUM-MOTION \u00a78.4, Q60).",
        "type": "boolean"
      },
      "motion_film": {
        "description": "P04-20 (additive v1 note): the Motion Film settings of a promotional brief (kind product_intro, launch, feature, ad_story, brand_sting or product_film; KARAR-MOTION-FILM \u00a74.1). The server resolves every value the user did not state from preparation-rules.json motion_film.defaults (no narration, music + SFX, kinetic on-screen text, no captions) and lists it in assumptions (source product_default, field motion_film.<name>). `features` are the user's own feature sentences, verbatim: the inventory matches each screen to one of them. Absent on any other kind.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "narration",
          "music",
          "sfx",
          "on_screen_text",
          "captions"
        ],
        "properties": {
          "narration": {
            "description": "`none` = a screen-text film without voice-over; `tts` only when the user asked for a voice-over.",
            "enum": [
              "none",
              "tts"
            ]
          },
          "music": {
            "type": "boolean"
          },
          "sfx": {
            "type": "boolean"
          },
          "on_screen_text": {
            "description": "`kinetic` = animated quoted copy; `static` = still copy; `none` = a film without copy.",
            "enum": [
              "kinetic",
              "static",
              "none"
            ]
          },
          "captions": {
            "description": "Captions on keep the bottom band of the frame empty (doctrine 9).",
            "type": "boolean"
          },
          "features": {
            "type": "array",
            "maxItems": 10,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 300
            }
          }
        }
      },
      "truth_sources": {
        "description": "P04-22 (additive v1 note): where a promotional film may take its facts from (KARAR-PREMIUM-MOTION \u00a78.1 do\u011fruluk kural\u0131): the user's own words, the screenshots they gave, their site, their files. Every number and every claim a redrawn screen shows must come from here or from the user's feature sentences (`motion_film.features`); no feature, customer, review or figure is invented, and where no figure exists a figureless depiction is used. `text` carries the user's own words verbatim (bounded), `ref` names a Storage asset, `url` a page the user gave. Absent = the brief's own goal, topic and feature sentences are the only truth.",
        "type": "array",
        "maxItems": 20,
        "items": {
          "$ref": "#/$defs/TruthSource"
        }
      },
      "output_goal": {
        "description": "Stop point of the job: script_only/plan_only never start media (K203); preview_only keeps its own stop in Auto.",
        "enum": [
          "final_video",
          "preview_only",
          "plan_only",
          "script_only"
        ]
      },
      "freshness": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "mode"
        ],
        "properties": {
          "mode": {
            "enum": [
              "evergreen",
              "current_events",
              "dated"
            ]
          },
          "anchor_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "window_start": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "window_end": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "user_time_zone": {
            "type": "string",
            "maxLength": 64
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "mode": {
                  "enum": [
                    "current_events",
                    "dated"
                  ]
                }
              }
            },
            "then": {
              "required": [
                "anchor_at"
              ]
            }
          }
        ]
      },
      "constraints": {
        "description": "Explicit user constraints, verbatim-summarised; never inferred defaults.",
        "type": "array",
        "maxItems": 30,
        "items": {
          "type": "string",
          "minLength": 1,
          "maxLength": 500
        }
      },
      "assumptions": {
        "description": "Visible product assumptions ('Varsay\u0131mlar\u0131m') with their source; a user can see and change them.",
        "type": "array",
        "maxItems": 30,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "field",
            "value",
            "source"
          ],
          "properties": {
            "field": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_.]{0,63}$"
            },
            "value": {
              "type": [
                "string",
                "number",
                "boolean"
              ]
            },
            "source": {
              "$ref": "common.schema.json#/$defs/SelectionSource"
            }
          }
        }
      },
      "preferences": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "source_hints": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "string",
              "maxLength": 500
            }
          },
          "brand_kit": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "template": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "avatar": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "voice": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "no_avatar": {
            "type": "boolean"
          },
          "captions": {
            "description": "SV (additive v1 note): the user asked for captions of the narrated video (burned in, bound to the script). Written by the server from the user's own words (altyazi / captions / subtitles); absent = no caption track.",
            "type": "boolean"
          },
          "text_model_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/ModelId"
          },
          "media_profile": {
            "enum": [
              "economy",
              "balanced",
              "quality"
            ]
          },
          "media_model_ids": {
            "description": "P04-01 (additive v1 note): the job's selected media model per capability (composer selection or explicit request). A preference the plan keeps or reports as unsupported, never silently replaced.",
            "type": "object",
            "maxProperties": 8,
            "propertyNames": {
              "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
              "maxLength": 64
            },
            "additionalProperties": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/ModelId"
            }
          },
          "budget": {
            "description": "P04-01 (additive v1 note): the user's stated budget for this job. A preference that bounds preparation choices (e.g. research max_credits), never a spend authority: the approved ceiling stays with Billing and the job envelope.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "max_credits",
              "source"
            ],
            "properties": {
              "max_credits": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 1000000,
                "multipleOf": 0.0001
              },
              "source": {
                "$ref": "common.schema.json#/$defs/SelectionSource"
              }
            }
          }
        }
      },
      "channel_context": {
        "description": "P04-01 (additive v1 note): refs of the permitted channel Memory context the brief was bound with (profile first, then related episodes of the channel audience; never private episodes, never content). An observation, never a channel rule (KARAR-CHAT \u00a73). delta_sync is the P01C-17 bounded sync hint status.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status",
          "delta_sync"
        ],
        "properties": {
          "status": {
            "enum": [
              "ok",
              "empty",
              "memory_off",
              "not_bound",
              "unavailable"
            ]
          },
          "profile_fence": {
            "type": "string",
            "pattern": "^cm:[a-z0-9.]{1,63}$"
          },
          "profile_generation": {
            "type": "integer",
            "minimum": 0
          },
          "episode_refs": {
            "type": "array",
            "maxItems": 10,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "episode_id",
                "source_revision"
              ],
              "properties": {
                "episode_id": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
                },
                "source_revision": {
                  "type": "integer",
                  "minimum": 1
                }
              }
            }
          },
          "delta_sync": {
            "enum": [
              "not_requested",
              "requested",
              "not_connected",
              "not_available",
              "budget_exhausted",
              "up_to_date",
              "job_required",
              "retry_later",
              "failed",
              "skipped_memory_off"
            ]
          }
        }
      }
    },
    "$defs": {
      "TruthSource": {
        "description": "P04-22: one source of truth of a promotional brief. `user_text` = the user's own words of this job, `screenshot` and `file` = a Storage asset the user gave, `website` = a page the user named.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind"
        ],
        "properties": {
          "kind": {
            "enum": [
              "user_text",
              "screenshot",
              "website",
              "file"
            ]
          },
          "label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "ref": {
            "$ref": "common.schema.json#/$defs/OwnerResourceRef"
          },
          "url": {
            "type": "string",
            "pattern": "^https://[^\\s]{1,2000}$"
          }
        },
        "anyOf": [
          {
            "required": [
              "text"
            ]
          },
          {
            "required": [
              "ref"
            ]
          },
          {
            "required": [
              "url"
            ]
          }
        ]
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
  "motion-spark/v1/motion-shot-spec.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/motion-shot-spec.schema.json",
    "title": "MotionShotSpec (per-scene, Motion Film karari SS4.3)",
    "description": "The director model writes this per scene; motion_compiler turns it into Motion IR deterministically. No pixels, ease curves, milliseconds or code here -- those come from the blueprint + energy variant.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "blueprint_ref",
      "posture",
      "slots",
      "windows",
      "energy",
      "ratio"
    ],
    "properties": {
      "blueprint_ref": {
        "$ref": "common.schema.json#/$defs/SemverRevisionRef"
      },
      "posture": {
        "type": "string",
        "enum": [
          "reproduce",
          "adapt",
          "compose"
        ],
        "description": "compose = L1/L2 code (Q40)."
      },
      "slots": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "slot_id",
            "kind",
            "value"
          ],
          "properties": {
            "slot_id": {
              "type": "string",
              "minLength": 1
            },
            "kind": {
              "type": "string",
              "enum": [
                "text",
                "media",
                "number",
                "list"
              ]
            },
            "value": {},
            "overflow_policy": {
              "type": "string",
              "enum": [
                "shrink_then_wrap",
                "wrap",
                "truncate_suggestion"
              ]
            }
          }
        }
      },
      "windows": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "slot_id",
            "anchor",
            "move"
          ],
          "properties": {
            "slot_id": {
              "type": "string",
              "minLength": 1
            },
            "anchor": {
              "$ref": "common.schema.json#/$defs/Anchor"
            },
            "move": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      },
      "camera": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "phase"
          ],
          "properties": {
            "phase": {
              "type": "string",
              "enum": [
                "push",
                "pan",
                "zoom_to_target",
                "pull_back",
                "static"
              ]
            },
            "focus_region_ref": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      },
      "seam_in": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "zoom_through",
              "reverse_zoom_through",
              "direction_matched_cut",
              "word_wave_cut",
              "blur_crossfade",
              "push_slide",
              "hard_cut",
              "none"
            ]
          },
          "carry_over_handle": {
            "$ref": "common.schema.json#/$defs/Handle"
          }
        }
      },
      "seam_out": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "zoom_through",
              "reverse_zoom_through",
              "direction_matched_cut",
              "word_wave_cut",
              "blur_crossfade",
              "push_slide",
              "hard_cut",
              "none"
            ]
          },
          "carry_over_handle": {
            "$ref": "common.schema.json#/$defs/Handle"
          }
        }
      },
      "energy": {
        "$ref": "common.schema.json#/$defs/Energy"
      },
      "sfx_cues": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "whoosh",
            "click",
            "typing",
            "pop",
            "hit",
            "riser",
            "ui-notify",
            "transition"
          ]
        }
      },
      "ratio": {
        "$ref": "common.schema.json#/$defs/RatioToken"
      }
    }
  },
  "motion-spark/v1/slot-media-request.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/slot-media-request.schema.json",
    "title": "SlotMediaRequest (Motion Film karari SS5.1)",
    "description": "Typed per-slot media need the director writes; the director never writes engine code for this. Model selection (Kling/Seedance/etc.) is out of scope here (Provider catalog owns it) -- this schema is only the request shape.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "slot_id",
      "purpose",
      "target",
      "time_policy"
    ],
    "properties": {
      "slot_id": {
        "type": "string",
        "minLength": 1
      },
      "purpose": {
        "type": "string",
        "enum": [
          "atmosphere",
          "usage_moment",
          "background",
          "product_screen"
        ]
      },
      "prompt": {
        "type": "string",
        "minLength": 1
      },
      "reference_asset_refs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "target": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ratio",
          "duration_s",
          "motion_need"
        ],
        "properties": {
          "ratio": {
            "$ref": "common.schema.json#/$defs/RatioToken"
          },
          "duration_s": {
            "type": "number",
            "exclusiveMinimum": 0
          },
          "motion_need": {
            "type": "string",
            "enum": [
              "static",
              "camera",
              "subject"
            ]
          }
        }
      },
      "time_policy": {
        "type": "string",
        "enum": [
          "hold_last_frame",
          "trim_slot",
          "reject"
        ],
        "description": "SS5.1: applied when the produced clip is shorter than the slot."
      },
      "representational": {
        "type": "boolean",
        "default": false,
        "description": "Q39: true only on explicit user request for an AI mockup product screen; must be labeled 'temsili' everywhere it appears."
      }
    }
  },
  "motion-spark/v1/story-beats.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/story-beats.schema.json",
    "title": "StoryBeats (Premium Motion karari SS8.2, MotionStoryboard.arc typed form)",
    "description": "Typed arc for promotional VideoBrief kinds. Timing ratios are default config suggestions, not hard limits.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "beats",
      "message"
    ],
    "properties": {
      "message": {
        "type": "string",
        "minLength": 1,
        "description": "The single sentence the film proves."
      },
      "beats": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "beat",
            "range_s"
          ],
          "properties": {
            "beat": {
              "type": "string",
              "enum": [
                "hook",
                "reveal",
                "feature_loop",
                "proof",
                "breather",
                "cta"
              ]
            },
            "range_s": {
              "type": "array",
              "items": {
                "type": "number",
                "minimum": 0
              },
              "minItems": 2,
              "maxItems": 2
            },
            "notes": {
              "type": "string"
            }
          }
        }
      },
      "shareable_frame_s": {
        "type": "number",
        "minimum": 0,
        "description": "SS8.2: the storyboard's 'hero frame', rendered free and offered as a thumbnail candidate."
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

export const DOCUMENT_TYPES = ["motion-code-scene-proposal", "motion-film-inventory", "motion-film-storyboard-proposal", "motion-scene-request", "plan-change-impact", "preparation-artifact-revision", "preparation-body-page", "preparation-validation-report", "production-plan", "production-plan-summary", "publish-package", "publish-package-proposal", "research-pack", "script-artifact", "shot-plan", "shot-plan-proposal", "video-brief"] as const;
export type DocumentType = "motion-code-scene-proposal" | "motion-film-inventory" | "motion-film-storyboard-proposal" | "motion-scene-request" | "plan-change-impact" | "preparation-artifact-revision" | "preparation-body-page" | "preparation-validation-report" | "production-plan" | "production-plan-summary" | "publish-package" | "publish-package-proposal" | "research-pack" | "script-artifact" | "shot-plan" | "shot-plan-proposal" | "video-brief";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "motion-code-scene-proposal": [
    "motion_code_scene_proposal_v1"
  ],
  "motion-film-inventory": [
    "motion_film_inventory_v1"
  ],
  "motion-film-storyboard-proposal": [
    "motion_film_storyboard_proposal_v1"
  ],
  "motion-scene-request": [
    "motion_scene_request_v1"
  ],
  "plan-change-impact": [
    "plan_change_impact_v1"
  ],
  "preparation-artifact-revision": [
    "preparation_artifact_revision_v1"
  ],
  "preparation-body-page": [
    "preparation_body_page_v1"
  ],
  "preparation-validation-report": [
    "preparation_validation_report_v1"
  ],
  "production-plan": [
    "production_plan_v1"
  ],
  "production-plan-summary": [
    "production_plan_summary_v1"
  ],
  "publish-package": [
    "publish_package_v1"
  ],
  "publish-package-proposal": [
    "publish_package_proposal_v1"
  ],
  "research-pack": [
    "research_pack_v1"
  ],
  "script-artifact": [
    "script_artifact_v1"
  ],
  "shot-plan": [
    "shot_plan_v1"
  ],
  "shot-plan-proposal": [
    "shot_plan_proposal_v1"
  ],
  "video-brief": [
    "video_brief_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type MotionCodeSceneProposal = {
    readonly "schema_version": "motion_code_scene_proposal_v1";
    readonly "summary": string;
    readonly "files": readonly (unknown)[];
    readonly "parameters": readonly (unknown)[];
    readonly "fonts"?: readonly (unknown)[];
    readonly "dependencies": readonly ("motion-runtime-sdk@1")[];
  };
export type MotionFilmInventory = {
    readonly "schema_version": "motion_film_inventory_v1";
    readonly "items": readonly (unknown)[];
  };
export type MotionFilmStoryboardProposal = {
    readonly "schema_version": "motion_film_storyboard_proposal_v1";
    readonly "message": string;
    readonly "audience"?: string;
    readonly "direction": {
    readonly "palette_roles": readonly (unknown)[];
    readonly "motion_grammar": string;
    readonly "reveal_model": string;
    readonly "prohibited": readonly (string)[];
  };
    readonly "hero_scene"?: number;
    readonly "scenes": readonly (unknown)[];
  };
export type MotionSceneRequest = {
    readonly "schema_version": "motion_scene_request_v1";
    readonly "request_kind": "explicit_code" | "library_gap" | "quality_upgrade" | "original_code";
    readonly "scope"?: "scene" | "component";
    readonly "instruction": string;
    readonly "scene": {
    readonly "role"?: string;
    readonly "duration_seconds": number;
    readonly "slots"?: readonly (unknown)[];
  };
    readonly "video_style": {
    readonly "preset_ref": unknown;
  };
    readonly "fallback_blueprint_ref"?: unknown;
    readonly "base_revision_id"?: string;
  };
export type PlanChangeImpact = {
    readonly "schema_version": "plan_change_impact_v1";
    readonly "job_id": unknown;
    readonly "from_plan_ref": (unknown) & ({
    readonly "artifact_kind"?: "production_plan";
  });
    readonly "to_plan_ref": (unknown) & ({
    readonly "artifact_kind"?: "production_plan";
  });
    readonly "approval": {
    readonly "from_g1_fingerprint_sha256": (unknown) | (null);
    readonly "to_g1_fingerprint_sha256": (unknown) | (null);
    readonly "carries_over": boolean;
  };
    readonly "changes": {
    readonly "brief_fields": readonly (string)[];
    readonly "script": {
    readonly "narration_changed_beat_ids": unknown;
    readonly "added_beat_ids": unknown;
    readonly "removed_beat_ids": unknown;
  };
    readonly "shots": {
    readonly "added": unknown;
    readonly "removed": unknown;
    readonly "changed": readonly ({
    readonly "shot_id": string;
    readonly "fields": readonly (string)[];
  })[];
  };
    readonly "scenes": {
    readonly "added": unknown;
    readonly "removed": unknown;
    readonly "changed": unknown;
  };
  };
    readonly "operations": readonly ({
    readonly "operation_key": string;
    readonly "effect": "unchanged" | "paid_regeneration" | "added" | "removed";
    readonly "from_operation_id"?: string;
    readonly "to_operation_id"?: string;
    readonly "category": "image" | "video" | "voice" | "avatar" | "other";
    readonly "shot_ids": readonly (string)[];
    readonly "credits_delta"?: number;
    readonly "reasons": readonly ("prompt_changed" | "model_changed" | "duration_changed" | "quality_changed" | "reference_changed" | "text_changed" | "voice_changed" | "format_changed" | "upstream_changed" | "input_changed" | "new_operation" | "operation_removed")[];
  })[];
    readonly "free_local_edits": readonly ({
    readonly "kind": "on_screen_text" | "scene_layout" | "transition" | "caption" | "shot_order" | "section_title";
    readonly "ref": string;
  })[];
    readonly "estimate": {
    readonly "from_status": "valid" | "computing" | "stale" | "unavailable";
    readonly "to_status": "valid" | "computing" | "stale" | "unavailable";
    readonly "from_max_credits": (number) | (null);
    readonly "to_max_credits": (number) | (null);
    readonly "delta_max_credits": (number) | (null);
  };
    readonly "decision": {
    readonly "paid_change": boolean;
    readonly "scope_exceeded": boolean;
    readonly "approved_max_credits": (number) | (null);
    readonly "requires_new_decision": boolean;
    readonly "reasons": readonly ("paid_operations_changed" | "estimate_exceeds_approved_scope" | "estimate_not_valid" | "target_plan_not_ready")[];
  };
  };
export type PreparationArtifactRevision = {
    readonly "schema_version": "preparation_artifact_revision_v1";
    readonly "artifact_id": string;
    readonly "artifact_kind": "video_brief" | "research_pack" | "script" | "shot_plan" | "production_plan";
    readonly "project_id": unknown;
    readonly "job_id": unknown;
    readonly "revision": unknown;
    readonly "parent_revision": (unknown) | (null);
    readonly "body_schema_version": "video_brief_v1" | "research_pack_v1" | "script_artifact_v1" | "shot_plan_v1" | "production_plan_v1";
    readonly "content_digest_sha256": unknown;
    readonly "body_bytes": number;
    readonly "dependency_refs": readonly (unknown)[];
    readonly "provenance": unknown;
    readonly "readiness": "draft" | "not_ready" | "ready" | "stale";
    readonly "validation_summary": {
    readonly "validator_revision": string;
    readonly "error_count": number;
    readonly "warning_count": number;
  };
    readonly "g1_fingerprint_sha256"?: unknown;
    readonly "created_by": {
    readonly "actor_user_id": string;
    readonly "origin": "agent" | "user" | "system";
  };
    readonly "created_at": unknown;
  };
export type PreparationBodyPage = {
    readonly "schema_version": "preparation_body_page_v1";
    readonly "artifact_ref": unknown;
    readonly "section": "header" | "chapters" | "shots" | "sources" | "claims";
    readonly "items": readonly (unknown)[];
    readonly "total_items": number;
    readonly "next_cursor": (string) | (null);
  };
export type PreparationValidationReport = {
    readonly "schema_version": "preparation_validation_report_v1";
    readonly "artifact_ref": unknown;
    readonly "readiness": "draft" | "not_ready" | "ready";
    readonly "validator_revision": string;
    readonly "validators": readonly ({
    readonly "validator": "schema" | "semantic" | "coverage" | "timing" | "capability" | "estimate";
    readonly "status": "passed" | "failed" | "not_applicable";
    readonly "error_count": number;
  })[];
    readonly "issues": readonly (unknown)[];
    readonly "issues_truncated": boolean;
    readonly "validated_at": unknown;
  };
export type ProductionPlan = {
    readonly "schema_version": "production_plan_v1";
    readonly "refs": {
    readonly "brief": (unknown) & ({
    readonly "artifact_kind"?: "video_brief";
  });
    readonly "research"?: (unknown) & ({
    readonly "artifact_kind"?: "research_pack";
  });
    readonly "script": (unknown) & ({
    readonly "artifact_kind"?: "script";
  });
    readonly "shot_plan": (unknown) & ({
    readonly "artifact_kind"?: "shot_plan";
  });
  };
    readonly "execution": {
    readonly "status": "compiled" | "pending_compiler";
    readonly "dsl_hash"?: unknown;
    readonly "workflow_draft_ref"?: {
    readonly "draft_id": unknown;
    readonly "dsl_hash": unknown;
  };
    readonly "node_impl_pins": readonly ({
    readonly "node_type": string;
    readonly "implementation_revision": string;
    readonly "node_key"?: string;
  })[];
    readonly "operation_count"?: number;
    readonly "compiler_revision"?: string;
    readonly "execution_dsl_hash"?: unknown;
    readonly "pin_fingerprint_hash"?: unknown;
    readonly "estimate_ref"?: {
    readonly "workflow_estimate_id": unknown;
    readonly "expires_at": unknown;
  };
    readonly "operations"?: readonly (unknown)[];
    readonly "compile_issues"?: readonly ({
    readonly "code": string;
    readonly "ref"?: string;
  })[];
  };
    readonly "estimate": {
    readonly "status": "valid" | "computing" | "stale" | "unavailable";
    readonly "estimate_revision"?: unknown;
    readonly "pricing_snapshot_hash"?: unknown;
    readonly "currency_unit": "credits";
    readonly "point_credits"?: number;
    readonly "min_credits"?: number;
    readonly "max_credits"?: number;
    readonly "preparation_spent_credits"?: number;
    readonly "includes_final_render": boolean;
    readonly "line_items": readonly ({
    readonly "item_id": string;
    readonly "category": "research" | "script" | "image" | "video" | "voice" | "avatar" | "stock" | "render" | "repair" | "other";
    readonly "operation_count": number;
    readonly "output_count"?: number;
    readonly "units_seconds"?: number;
    readonly "credits_min": number;
    readonly "credits_max": number;
    readonly "shot_ids"?: readonly (string)[];
    readonly "capability"?: unknown;
  })[];
    readonly "computed_at"?: unknown;
    readonly "expires_at"?: unknown;
  };
    readonly "budget_policy": {
    readonly "approved_max_credits": (number) | (null);
    readonly "repair_attempts_max": number;
    readonly "timing_fit": "hold_trim_pause" | "none";
  };
    readonly "bindings": readonly ({
    readonly "role": "avatar" | "voice" | "template" | "intro" | "outro" | "element" | "kit";
    readonly "target": {
    readonly "scope": "global" | "shot" | "slot";
    readonly "shot_id"?: string;
    readonly "slot_id"?: string;
  };
    readonly "resource": (unknown) | (null);
    readonly "selection_source": "explicit" | "job_selection" | "template" | "channel_default" | "personal_default" | "product_default" | "product_suggestion";
    readonly "rule_ref"?: unknown;
  })[];
  };
export type ProductionPlanSummary = {
    readonly "schema_version": "production_plan_summary_v1";
    readonly "project_id": unknown;
    readonly "job_id": unknown;
    readonly "plan": {
    readonly "artifact_ref": (unknown) | (null);
    readonly "readiness": ("draft" | "not_ready" | "ready" | "stale") | ("missing");
    readonly "g1_fingerprint_sha256"?: unknown;
    readonly "output_goal"?: "final_video" | "preview_only" | "plan_only" | "script_only";
  };
    readonly "artifacts": readonly ({
    readonly "artifact_kind": "video_brief" | "research_pack" | "script" | "shot_plan" | "production_plan";
    readonly "artifact_id": string;
    readonly "head_revision": unknown;
    readonly "head_digest_sha256": unknown;
    readonly "head_readiness": "draft" | "not_ready" | "ready";
    readonly "pinned_revision": (unknown) | (null);
    readonly "stale": boolean;
  })[];
    readonly "counts": {
    readonly "target_seconds": (number) | (null);
    readonly "planned_seconds": (number) | (null);
    readonly "chapters_total": (number) | (null);
    readonly "chapters_enabled": (number) | (null);
    readonly "chapters_with_full_narration": (number) | (null);
    readonly "beats_total": (number) | (null);
    readonly "shots_total": (number) | (null);
    readonly "new_image_outputs": (number) | (null);
    readonly "new_video_outputs": (number) | (null);
    readonly "new_audio_outputs": (number) | (null);
    readonly "reused_unique_assets": (number) | (null);
    readonly "generated_seconds": (number) | (null);
  };
    readonly "estimate_box": {
    readonly "status": "valid" | "computing" | "stale" | "unavailable" | "missing";
    readonly "estimate_revision"?: unknown;
    readonly "point_credits"?: number;
    readonly "min_credits"?: number;
    readonly "max_credits"?: number;
    readonly "approved_max_credits": (number) | (null);
    readonly "includes_final_render": (boolean) | (null);
    readonly "expires_at"?: unknown;
  };
    readonly "issues": readonly (unknown)[];
  };
export type PublishPackage = {
    readonly "schema_version": "publish_package_v1";
    readonly "language": string;
    readonly "basis": (unknown);
    readonly "titles": {
    readonly "options": readonly ({
    readonly "title_id": string;
    readonly "text": string;
  })[];
    readonly "selected_title_id": string;
  };
    readonly "description": string;
    readonly "tags": readonly (string)[];
    readonly "thumbnail": unknown;
    readonly "chapters"?: readonly ({
    readonly "chapter_id": string;
    readonly "start_seconds": number;
    readonly "title": string;
  })[];
  };
export type PublishPackageProposal = {
    readonly "schema_version": "publish_package_proposal_v1";
    readonly "titles": readonly (string)[];
    readonly "selected_title": number;
    readonly "description": string;
    readonly "tags": readonly (string)[];
    readonly "thumbnail": unknown;
    readonly "chapters"?: readonly (unknown)[];
  };
export type ResearchPack = {
    readonly "schema_version": "research_pack_v1";
    readonly "query_scope": {
    readonly "queries": readonly (string)[];
    readonly "scope_note"?: string;
  };
    readonly "as_of": unknown;
    readonly "freshness_policy_revision"?: string;
    readonly "revalidate_after"?: unknown;
    readonly "sources": readonly (unknown)[];
    readonly "claims": readonly (unknown)[];
    readonly "coverage": {
    readonly "status": "sufficient" | "insufficient" | "not_required";
    readonly "reason"?: string;
  };
  };
export type ScriptArtifact = {
    readonly "schema_version": "script_artifact_v1";
    readonly "result_kind": "full" | "outline";
    readonly "narration_mode"?: "spoken" | "none";
    readonly "title": string;
    readonly "language": string;
    readonly "angle": string;
    readonly "hook": {
    readonly "options": readonly ({
    readonly "hook_id": string;
    readonly "text": string;
  })[];
    readonly "selected_hook_id": string;
  };
    readonly "purpose": string;
    readonly "key_message": string;
    readonly "narrative_flow": string;
    readonly "brief_ref"?: unknown;
    readonly "research_ref"?: unknown;
    readonly "chapters": readonly (unknown)[];
    readonly "totals": {
    readonly "estimated_seconds": number;
    readonly "word_count": number;
    readonly "speech_rate_wpm": number;
    readonly "rate_basis": "measured" | "assumed";
  };
  };
export type ShotPlan = {
    readonly "schema_version": "shot_plan_v1";
    readonly "script_ref": (unknown) & ({
    readonly "artifact_kind"?: "script";
  });
    readonly "brief_ref"?: (unknown) & ({
    readonly "artifact_kind"?: "video_brief";
  });
    readonly "shots": readonly (unknown)[];
    readonly "motion_storyboard"?: unknown;
    readonly "asset_inventory"?: readonly (unknown)[];
    readonly "sections"?: readonly (unknown)[];
    readonly "scenes"?: readonly (unknown)[];
    readonly "narration"?: unknown;
    readonly "production_mode"?: "storyboard_draft";
    readonly "audio_intents"?: readonly (unknown)[];
  };
export type ShotPlanProposal = {
    readonly "schema_version": "shot_plan_proposal_v1";
    readonly "shots": readonly (unknown)[];
  };
export type VideoBrief = {
    readonly "schema_version": "video_brief_v1";
    readonly "kind": "general" | "news_explainer" | "historical_explainer" | "short_video" | "edit_existing" | "product_intro" | "launch" | "feature" | "ad_story" | "brand_sting" | "product_film" | "presentation" | "lecture_slides";
    readonly "title"?: string;
    readonly "goal": string;
    readonly "topic": string;
    readonly "audience": string;
    readonly "locale": string;
    readonly "target_duration_seconds": number;
    readonly "aspect_ratio": "16:9" | "9:16" | "1:1";
    readonly "format"?: "short_vertical" | "long_form";
    readonly "loop"?: boolean;
    readonly "motion_film"?: {
    readonly "narration": "none" | "tts";
    readonly "music": boolean;
    readonly "sfx": boolean;
    readonly "on_screen_text": "kinetic" | "static" | "none";
    readonly "captions": boolean;
    readonly "features"?: readonly (string)[];
  };
    readonly "truth_sources"?: readonly (unknown)[];
    readonly "output_goal": "final_video" | "preview_only" | "plan_only" | "script_only";
    readonly "freshness": {
    readonly "mode": "evergreen" | "current_events" | "dated";
    readonly "anchor_at"?: unknown;
    readonly "window_start"?: unknown;
    readonly "window_end"?: unknown;
    readonly "user_time_zone"?: string;
  };
    readonly "constraints": readonly (string)[];
    readonly "assumptions": readonly ({
    readonly "field": string;
    readonly "value": string | number | boolean;
    readonly "source": "explicit" | "job_selection" | "template" | "channel_default" | "personal_default" | "product_default" | "product_suggestion";
  })[];
    readonly "preferences"?: {
    readonly "source_hints"?: readonly (string)[];
    readonly "brand_kit"?: unknown;
    readonly "template"?: unknown;
    readonly "avatar"?: unknown;
    readonly "voice"?: unknown;
    readonly "no_avatar"?: boolean;
    readonly "captions"?: boolean;
    readonly "text_model_id"?: unknown;
    readonly "media_profile"?: "economy" | "balanced" | "quality";
    readonly "media_model_ids"?: Record<string, unknown>;
    readonly "budget"?: {
    readonly "max_credits": number;
    readonly "source": "explicit" | "job_selection" | "template" | "channel_default" | "personal_default" | "product_default" | "product_suggestion";
  };
  };
    readonly "channel_context"?: {
    readonly "status": "ok" | "empty" | "memory_off" | "not_bound" | "unavailable";
    readonly "profile_fence"?: string;
    readonly "profile_generation"?: number;
    readonly "episode_refs"?: readonly ({
    readonly "episode_id": unknown;
    readonly "source_revision": number;
  })[];
    readonly "delta_sync": "not_requested" | "requested" | "not_connected" | "not_available" | "budget_exhausted" | "up_to_date" | "job_required" | "retry_later" | "failed" | "skipped_memory_off";
  };
  };

export const reader = new ContractPackageReader({
  package: "video-preparation",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
