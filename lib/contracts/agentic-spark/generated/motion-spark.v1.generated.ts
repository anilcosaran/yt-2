// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/motion-spark/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "annotation-cue.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/annotation-cue.schema.json",
    "title": "AnnotationCue (Anlatim karari SS2, IR track)",
    "description": "An emphasis mark on a screen recording or image. Style comes from VideoStyle; timing floats around the anchor.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "target",
      "type",
      "anchor",
      "timing"
    ],
    "properties": {
      "target": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "asset_ref",
              "region"
            ],
            "properties": {
              "asset_ref": {
                "type": "string",
                "minLength": 1
              },
              "region": {
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
              "handle"
            ],
            "properties": {
              "handle": {
                "$ref": "common.schema.json#/$defs/Handle"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "ocr_span_id"
            ],
            "properties": {
              "ocr_span_id": {
                "type": "string",
                "minLength": 1
              }
            }
          }
        ]
      },
      "type": {
        "type": "string",
        "enum": [
          "circle",
          "box",
          "underline",
          "highlight",
          "strike",
          "arrow_to",
          "bracket",
          "replace"
        ]
      },
      "replace": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "old",
          "new"
        ],
        "properties": {
          "old": {
            "type": "string",
            "minLength": 1
          },
          "new": {
            "type": "string",
            "minLength": 1
          }
        },
        "description": "Required when type=replace: both values must have a source; there is no negative-only replace."
      },
      "anchor": {
        "$ref": "common.schema.json#/$defs/Anchor"
      },
      "evidence_refs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "confidence_band": {
        "type": "string",
        "enum": [
          "high",
          "medium",
          "low"
        ]
      },
      "timing": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "draw_lead_ms",
          "hold_max_s",
          "exit_s"
        ],
        "properties": {
          "draw_lead_ms": {
            "type": "number",
            "const": 100
          },
          "hold_max_s": {
            "type": "number",
            "maximum": 2.5
          },
          "exit_s": {
            "type": "number",
            "const": 0.25
          }
        },
        "description": "SS2: draw starts 100ms before anchor and takes 0.4-0.7s (engine-side); hold <=2.5s, exit 0.25s."
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "type": {
              "const": "replace"
            }
          },
          "required": [
            "type"
          ]
        },
        "then": {
          "required": [
            "replace"
          ]
        }
      }
    ]
  },
  "audio-mix-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/audio-mix-plan.schema.json",
    "title": "AudioMixPlan (Q57)",
    "description": "Typed part of the Composition document; there is no separate audio editor. Ducking is a deterministic precomputed gain envelope (TK-21): preview and final must be within +-0.5 LU / <=0.5 dB of each other after LUFS normalization.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "buses",
      "ducking",
      "final_target"
    ],
    "properties": {
      "buses": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "voice": {
            "$ref": "#/$defs/Bus"
          },
          "source_dialogue": {
            "$ref": "#/$defs/Bus"
          },
          "music": {
            "$ref": "#/$defs/Bus"
          },
          "sfx": {
            "$ref": "#/$defs/Bus"
          },
          "ambience": {
            "$ref": "#/$defs/Bus"
          }
        }
      },
      "ducking": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "depth_db",
          "attack_ms",
          "release_ms"
        ],
        "properties": {
          "depth_db": {
            "type": "number"
          },
          "attack_ms": {
            "type": "number",
            "exclusiveMinimum": 0
          },
          "release_ms": {
            "type": "number",
            "exclusiveMinimum": 0
          }
        },
        "description": "Default -12 dB, 150 ms attack, 400 ms release (config)."
      },
      "background_level_offset_db": {
        "type": "number"
      },
      "automation_envelopes": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "bus",
            "start_s",
            "end_s",
            "gain_db"
          ],
          "properties": {
            "bus": {
              "type": "string",
              "enum": [
                "voice",
                "source_dialogue",
                "music",
                "sfx",
                "ambience"
              ]
            },
            "start_s": {
              "type": "number",
              "minimum": 0
            },
            "end_s": {
              "type": "number",
              "minimum": 0
            },
            "gain_db": {
              "type": "number"
            },
            "ramp_ms": {
              "type": "number",
              "minimum": 0
            }
          }
        }
      },
      "final_target": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "lufs",
          "true_peak_dbtp"
        ],
        "properties": {
          "lufs": {
            "type": "number",
            "const": -14
          },
          "true_peak_dbtp": {
            "type": "number",
            "maximum": -1
          }
        },
        "description": "F44: -14 LUFS +-1, true peak <= -1 dBTP. Not user-editable in v1."
      }
    },
    "$defs": {
      "Bus": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "gain_db",
          "mute"
        ],
        "properties": {
          "gain_db": {
            "type": "number"
          },
          "mute": {
            "type": "boolean"
          },
          "clips": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "asset_ref",
                "gain_db"
              ],
              "properties": {
                "asset_ref": {
                  "type": "string",
                  "minLength": 1
                },
                "gain_db": {
                  "type": "number"
                },
                "fade_in_ms": {
                  "type": "number",
                  "minimum": 0
                },
                "fade_out_ms": {
                  "type": "number",
                  "minimum": 0
                }
              }
            }
          }
        }
      }
    }
  },
  "common.schema.json": {
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
  "content-package-manifest.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/content-package-manifest.schema.json",
    "title": "Content package manifest (P06-58 architecture, frozen by P00-13)",
    "description": "GSAP-parite karari SS3: skill-like versioned content packages (whiteboard, annotation, presenter_layout, kinetic_type, device_showcase, charts, overlays, transitions, premium_film, sketch...) layered on top of the small set of core engine parts. A package is data; it never requires new core code to add or update.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id_revision",
      "required_core_parts",
      "guide_ref",
      "supported_ratios",
      "fallback_chain",
      "owner",
      "status"
    ],
    "properties": {
      "id_revision": {
        "$ref": "common.schema.json#/$defs/SemverRevisionRef"
      },
      "required_core_parts": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "part",
            "version_range"
          ],
          "properties": {
            "part": {
              "type": "string",
              "enum": [
                "text",
                "shape_path",
                "media",
                "mask",
                "camera",
                "particle_physics",
                "ease_registry",
                "morph",
                "layout_solver",
                "render",
                "qc"
              ]
            },
            "version_range": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      },
      "patterns": {
        "type": "array",
        "items": {
          "$ref": "common.schema.json#/$defs/SemverRevisionRef"
        },
        "description": "Blueprint/tarif/preset ids carried by this package; each blueprint's own manifest is motion-blueprint-manifest.schema.json."
      },
      "guide_ref": {
        "type": "string",
        "minLength": 1,
        "description": "SYSTEM_INTERNAL usage guide reference; never shown to the end user."
      },
      "supported_ratios": {
        "type": "array",
        "items": {
          "$ref": "common.schema.json#/$defs/RatioToken"
        },
        "minItems": 1,
        "uniqueItems": true
      },
      "eval_set_ref": {
        "type": "string",
        "minLength": 1
      },
      "eval_thresholds": {
        "type": "object",
        "description": "Free-form named threshold map; values are 'olcum bekliyor' (pending measurement) strings until P06's eval run pins numbers.",
        "additionalProperties": {
          "oneOf": [
            {
              "type": "number"
            },
            {
              "const": "olcum bekliyor"
            }
          ]
        }
      },
      "fallback_chain": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        },
        "description": "GSAP-parite karari SS4 yedek zinciri: alternate pattern/package, then L1 code, then textless visual AI + engine text, then plainest pattern. Empty array only for packages with no in-flight fallback (e.g. transitions)."
      },
      "owner": {
        "type": "string",
        "minLength": 1
      },
      "status": {
        "type": "string",
        "enum": [
          "active",
          "degraded",
          "maintenance",
          "disabled"
        ]
      }
    }
  },
  "edit-context.schema.json": {
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
  "edit-op.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/edit-op.schema.json",
    "title": "IR EditOp (P00-13 owned catalog)",
    "description": "MOTOR SS5 (TK-24 normative table): one element of the composition_command_v1 envelope's `ops[]` array. The envelope itself (base_revision, read_set, idempotency_key, actor_user_id, origin, ops[]) is P00-04's composition_command_v1 -- referenced by name only, never redefined here. Each EditOp carries a permanent target handle, expected_version, a per-op read_set (for conflict detection) and typed params. `inverse` is server-computed for undo (TK-32) and is not authored by the caller.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "op",
      "target_handle",
      "expected_version",
      "read_set",
      "params"
    ],
    "properties": {
      "op": {
        "type": "string",
        "enum": [
          "setText",
          "setColorToken",
          "setMedia",
          "setDuration",
          "setEnergy",
          "swapBlueprint",
          "setPresentation",
          "setStyle",
          "transform",
          "move",
          "reorder",
          "hide",
          "remove",
          "addKitComponent",
          "setTiming",
          "shift",
          "retimeScene",
          "setHold",
          "setAnchor",
          "addTween",
          "setTween",
          "removeTween",
          "addKeyframe",
          "setKeyframe",
          "removeKeyframe",
          "convertToKeyframes",
          "splitTween",
          "setCameraPhase",
          "addCameraMove",
          "setFocusTarget",
          "setSeam",
          "setTransition",
          "setThumbnailFrame"
        ],
        "description": "Closed catalog (K318): a Wave 1 agent may not add a value here; any addition is a coordinator-approved v2 version bump."
      },
      "target_handle": {
        "$ref": "common.schema.json#/$defs/Handle"
      },
      "expected_version": {
        "type": "integer",
        "minimum": 0,
        "description": "CAS guard on the target node/track, analogous to base_revision at the envelope level but scoped to this one handle."
      },
      "read_set": {
        "type": "array",
        "items": {
          "$ref": "common.schema.json#/$defs/Handle"
        },
        "minItems": 1,
        "uniqueItems": true,
        "description": "Handles this op's validity depends on (e.g. a sibling handle used for reorder or seam continuity). Always includes target_handle."
      },
      "params": {
        "type": "object",
        "description": "Per-op payload; see the group `if/then` branches below. additionalProperties is closed per branch."
      },
      "inverse": {
        "description": "Server-computed reverse operation for undo (TK-32). Not authored by the client; opaque to this schema.",
        "not": {
          "type": "null"
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "op": {
              "const": "setText"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "value"
              ],
              "properties": {
                "value": {
                  "type": "string"
                },
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
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setColorToken"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "token"
              ],
              "properties": {
                "token": {
                  "$ref": "common.schema.json#/$defs/ColorRoleToken"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setMedia"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "media_ref"
              ],
              "properties": {
                "media_ref": {
                  "type": "string",
                  "minLength": 1
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setDuration"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "frames"
              ],
              "properties": {
                "frames": {
                  "type": "integer",
                  "minimum": 1
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setEnergy"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "energy"
              ],
              "properties": {
                "energy": {
                  "$ref": "common.schema.json#/$defs/Energy"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "swapBlueprint"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "blueprint_ref"
              ],
              "properties": {
                "blueprint_ref": {
                  "$ref": "common.schema.json#/$defs/SemverRevisionRef"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setPresentation"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "presentation"
              ],
              "properties": {
                "presentation": {
                  "type": "string",
                  "enum": [
                    "side_card",
                    "split",
                    "pip_camera",
                    "cutaway",
                    "interstitial"
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
            "op": {
              "const": "setStyle"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "field",
                "value"
              ],
              "properties": {
                "field": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Must be on the blueprint's allow-list; enforced by motion-spark-rules.json, not by this schema."
                },
                "value": {}
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "transform"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "minProperties": 1,
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
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "move"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
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
              },
              "description": "TK-24: the Spark UI drag-in-preview subset is exactly this op (normalized position only)."
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "reorder"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "new_index"
              ],
              "properties": {
                "new_index": {
                  "type": "integer",
                  "minimum": 0
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "hide"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "properties": {}
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "remove"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "properties": {}
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "addKitComponent"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "component_ref"
              ],
              "properties": {
                "component_ref": {
                  "type": "string",
                  "minLength": 1
                },
                "slot": {
                  "type": "string"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setTiming"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "anchor",
                "duration_frames"
              ],
              "properties": {
                "anchor": {
                  "$ref": "common.schema.json#/$defs/Anchor"
                },
                "duration_frames": {
                  "type": "integer",
                  "minimum": 1
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "shift"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "delta_frames"
              ],
              "properties": {
                "delta_frames": {
                  "type": "integer"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "retimeScene"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "time_scale"
              ],
              "properties": {
                "time_scale": {
                  "type": "number",
                  "exclusiveMinimum": 0
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setHold"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "frames"
              ],
              "properties": {
                "frames": {
                  "type": "integer",
                  "minimum": 0
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setAnchor"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "anchor"
              ],
              "properties": {
                "anchor": {
                  "$ref": "common.schema.json#/$defs/Anchor"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "addTween"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "property",
                "from",
                "to",
                "ease",
                "duration_frames"
              ],
              "properties": {
                "property": {
                  "type": "string",
                  "minLength": 1
                },
                "from": {},
                "to": {},
                "ease": {
                  "type": "string",
                  "minLength": 1
                },
                "duration_frames": {
                  "type": "integer",
                  "minimum": 1
                },
                "delay_frames": {
                  "type": "integer",
                  "minimum": 0
                },
                "stagger": {
                  "type": "object"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setTween"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "minProperties": 1,
              "properties": {
                "ease": {
                  "type": "string"
                },
                "duration_frames": {
                  "type": "integer",
                  "minimum": 1
                },
                "from": {},
                "to": {},
                "delay_frames": {
                  "type": "integer",
                  "minimum": 0
                },
                "stagger": {
                  "type": "object"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "removeTween"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "properties": {}
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "addKeyframe"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "offset",
                "value"
              ],
              "properties": {
                "offset": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100
                },
                "value": {},
                "ease": {
                  "type": "string"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setKeyframe"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "index"
              ],
              "properties": {
                "index": {
                  "type": "integer",
                  "minimum": 0
                },
                "offset": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100
                },
                "value": {},
                "ease": {
                  "type": "string"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "removeKeyframe"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "index"
              ],
              "properties": {
                "index": {
                  "type": "integer",
                  "minimum": 0
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "convertToKeyframes"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "properties": {}
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "splitTween"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "at_frame"
              ],
              "properties": {
                "at_frame": {
                  "type": "integer",
                  "minimum": 0
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setCameraPhase"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
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
                  "type": "string"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "addCameraMove"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "phase",
                "anchor"
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
                "anchor": {
                  "$ref": "common.schema.json#/$defs/Anchor"
                },
                "focus_region_ref": {
                  "type": "string"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setFocusTarget"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "focus_region_ref"
              ],
              "properties": {
                "focus_region_ref": {
                  "type": "string",
                  "minLength": 1
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setSeam"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "edge",
                "type"
              ],
              "properties": {
                "edge": {
                  "type": "string",
                  "enum": [
                    "in",
                    "out"
                  ]
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "zoom_through",
                    "reverse_zoom_through",
                    "direction_matched_cut",
                    "word_wave_cut",
                    "blur_crossfade",
                    "push_slide",
                    "hard_cut"
                  ]
                },
                "carry_over_handle": {
                  "$ref": "common.schema.json#/$defs/Handle"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "op": {
              "const": "setTransition"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
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
                    "hard_cut"
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
            "op": {
              "const": "setThumbnailFrame"
            }
          }
        },
        "then": {
          "properties": {
            "params": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "frame"
              ],
              "properties": {
                "frame": {
                  "$ref": "common.schema.json#/$defs/FrameIndex"
                }
              }
            }
          }
        }
      }
    ]
  },
  "edit-receipt.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/edit-receipt.schema.json",
    "title": "Edit receipt (P00-13 owned edit_receipt_status vocabulary)",
    "description": "MOTOR SS4: composition.edit.propose either applies immediately or returns a suggestion card; there is no separate `apply` tool (TK-01). The receipt reports which of the five stages the proposal reached. `refused` and `failed` always carry a reason; `verified` only after the affected frames were recompiled and passed QC.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "status",
      "actor",
      "origin",
      "op_count"
    ],
    "properties": {
      "status": {
        "$ref": "common.schema.json#/$defs/EditReceiptStatus"
      },
      "actor": {
        "type": "string",
        "minLength": 1,
        "description": "TK-32: the user on whose behalf the job/edit runs, even when origin is agent|system."
      },
      "origin": {
        "$ref": "common.schema.json#/$defs/Origin"
      },
      "op_count": {
        "type": "integer",
        "minimum": 1
      },
      "undo_group_id": {
        "type": "string",
        "minLength": 1,
        "description": "TK-23/TK-32: every applied/saved/verified receipt from one propose call is one undo group. Absent for refused/failed (nothing to undo) and absent for placeholder records (TK-32: never enter the undo stack)."
      },
      "reason": {
        "type": "string",
        "minLength": 1,
        "description": "Required on refused|failed."
      },
      "revision_before": {
        "type": "integer",
        "minimum": 0
      },
      "revision_after": {
        "type": "integer",
        "minimum": 0
      },
      "qc_passed": {
        "type": "boolean",
        "description": "Required on verified|failed: verified means recompiled + QC passed, failed can mean QC rejected the result."
      },
      "conflicts": {
        "type": "array",
        "description": "K242/TK-23: handles whose expected_version or read_set no longer matched at apply time.",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "handle",
            "kind"
          ],
          "properties": {
            "handle": {
              "$ref": "common.schema.json#/$defs/Handle"
            },
            "kind": {
              "type": "string",
              "enum": [
                "version_mismatch",
                "handle_missing",
                "handle_type_changed"
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
            "status": {
              "enum": [
                "refused",
                "failed"
              ]
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "required": [
            "reason"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "enum": [
                "verified",
                "failed"
              ]
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "required": [
            "qc_passed"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "enum": [
                "applied",
                "saved",
                "verified"
              ]
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "required": [
            "undo_group_id",
            "revision_before",
            "revision_after"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "refused"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "not": {
            "required": [
              "undo_group_id"
            ]
          }
        }
      }
    ]
  },
  "focus-cue.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/focus-cue.schema.json",
    "title": "FocusCue (Q103, Anlatim karari SS4)",
    "description": "Odak ve sure kararini SS4: numbers here are default suggestions, not a hard rule -- the model decides; a user-locked cue is never touched.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "range",
      "target",
      "shot",
      "decided_by",
      "locked"
    ],
    "properties": {
      "range": {
        "$ref": "common.schema.json#/$defs/Anchor"
      },
      "target": {
        "type": "string",
        "enum": [
          "speaker",
          "full_media",
          "media_region",
          "overlay"
        ]
      },
      "presentation": {
        "type": "string",
        "enum": [
          "side_card",
          "split",
          "pip_camera",
          "cutaway",
          "interstitial"
        ]
      },
      "shot": {
        "type": "string",
        "enum": [
          "full",
          "zoom_to",
          "pan_to",
          "push"
        ]
      },
      "scale": {
        "type": "number",
        "exclusiveMinimum": 0
      },
      "reason": {
        "type": "string"
      },
      "evidence_refs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "confidence_band": {
        "type": "string",
        "enum": [
          "high",
          "medium",
          "low"
        ]
      },
      "decided_by": {
        "type": "string",
        "enum": [
          "rule",
          "llm",
          "user"
        ]
      },
      "locked": {
        "type": "boolean"
      }
    }
  },
  "motion-blueprint-manifest.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/motion-blueprint-manifest.schema.json",
    "title": "Motion library blueprint manifest v1 (P06-37 seed, frozen by P00-13)",
    "description": "One versioned, typed MotionRevision pattern in the Motion Film library (Motion Film karari SS5), extended by the Premium Motion decision with adaptation/loop_capable/component_class.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id_revision",
      "roles",
      "duration_range",
      "slot_schema",
      "signature_move",
      "ratio_variants",
      "energy_variants",
      "seam_contract",
      "adaptation",
      "loop_capable",
      "component_class"
    ],
    "properties": {
      "id_revision": {
        "$ref": "common.schema.json#/$defs/SemverRevisionRef"
      },
      "roles": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "hook",
            "problem",
            "product_intro",
            "feature",
            "benefit",
            "proof",
            "cta",
            "brand_outro"
          ]
        },
        "minItems": 1,
        "uniqueItems": true
      },
      "duration_range": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "min_frames",
          "max_frames"
        ],
        "properties": {
          "min_frames": {
            "type": "integer",
            "minimum": 1
          },
          "max_frames": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "slot_schema": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "slot_id",
            "kind"
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
            "max_length": {
              "type": "integer",
              "minimum": 1
            },
            "overflow_policy": {
              "type": "string",
              "enum": [
                "shrink_then_wrap",
                "wrap",
                "truncate_suggestion"
              ]
            },
            "media_ratio": {
              "$ref": "common.schema.json#/$defs/RatioToken"
            },
            "list_cardinality": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "min": {
                  "type": "integer",
                  "minimum": 0
                },
                "max": {
                  "type": "integer",
                  "minimum": 0
                }
              }
            }
          }
        },
        "minItems": 1
      },
      "signature_move": {
        "type": "string",
        "minLength": 1,
        "description": "The move that makes the blueprint recognizable; never dropped on Adapt."
      },
      "window_template": {
        "type": "string",
        "minLength": 1
      },
      "ratio_variants": {
        "type": "array",
        "items": {
          "$ref": "common.schema.json#/$defs/RatioToken"
        },
        "minItems": 2,
        "uniqueItems": true,
        "description": "Q35: 16:9 and 9:16 are mandatory; 1:1 optional."
      },
      "energy_variants": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "energy",
            "time_scale",
            "ease_family"
          ],
          "properties": {
            "energy": {
              "$ref": "common.schema.json#/$defs/Energy"
            },
            "time_scale": {
              "type": "number",
              "exclusiveMinimum": 0
            },
            "ease_family": {
              "type": "string",
              "minLength": 1
            },
            "blur_allowed": {
              "type": "boolean"
            },
            "overshoot_allowed": {
              "type": "boolean"
            }
          }
        },
        "minItems": 1
      },
      "seam_contract": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "seam_in",
          "seam_out"
        ],
        "properties": {
          "seam_in": {
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
          "seam_out": {
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
          }
        }
      },
      "sfx_cue_points": {
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
      "uses_recipes": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "alternatives": {
        "type": "array",
        "items": {
          "$ref": "common.schema.json#/$defs/SemverRevisionRef"
        },
        "description": "Q34 'Kalip' control candidates: other blueprints sharing this one's slot_schema shape."
      },
      "adaptation": {
        "type": "string",
        "enum": [
          "native",
          "rule_adapted",
          "model_adapted",
          "manual_review"
        ],
        "description": "Q56 ratio adaptation ladder result for the blueprint's non-native ratios."
      },
      "loop_capable": {
        "type": "boolean",
        "description": "SS8.4: only loop_capable blueprints are candidates when VideoBrief.loop = true."
      },
      "component_class": {
        "$ref": "common.schema.json#/$defs/ComponentClass"
      },
      "style_bindings": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        },
        "description": "Q55 SS3.3: token-bound fields; a blueprint without declared style_bindings is 'stil kilitli' (style-locked) in a mix."
      }
    }
  },
  "motion-shot-spec.schema.json": {
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
  "presenter-layout.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/presenter-layout.schema.json",
    "title": "PresenterLayout (Anlatim karari SS6, motor blueprint)",
    "description": "caption_zone is fixed across every layout of one production so captions never jump when the layout changes. Transitions are FLIP, <=400ms.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "pattern",
      "regions",
      "transition_ms"
    ],
    "properties": {
      "pattern": {
        "type": "string",
        "enum": [
          "full",
          "pip",
          "cam_card_plus_content",
          "cutout_over_content",
          "split_2",
          "split_3",
          "grid_4",
          "content_only",
          "interstitial"
        ]
      },
      "pip_config": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "corner": {
            "type": "string",
            "enum": [
              "top_left",
              "top_right",
              "bottom_left",
              "bottom_right"
            ]
          },
          "shape": {
            "type": "string",
            "enum": [
              "circle",
              "rounded_rect"
            ]
          },
          "size_pct": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 100
          }
        }
      },
      "regions": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ratio",
            "name",
            "box"
          ],
          "properties": {
            "ratio": {
              "$ref": "common.schema.json#/$defs/RatioToken"
            },
            "name": {
              "type": "string",
              "enum": [
                "content",
                "camera",
                "caption_zone",
                "lower_third",
                "corner_badge",
                "cta"
              ]
            },
            "camera_index": {
              "type": "integer",
              "minimum": 0
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
        }
      },
      "transition_ms": {
        "type": "number",
        "exclusiveMinimum": 0,
        "maximum": 400
      },
      "camera_frame_token": {
        "type": "string",
        "minLength": 1
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "pattern": {
              "const": "pip"
            }
          },
          "required": [
            "pattern"
          ]
        },
        "then": {
          "required": [
            "pip_config"
          ]
        }
      }
    ]
  },
  "reference-analysis.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/reference-analysis.schema.json",
    "title": "ReferenceAnalysis (Klon/Avatar karari SS1.3)",
    "description": "Output of decomposing a reference video into our library's vocabulary; a plan source, never a copy of the reference's own footage/music. Fields mirror the decision's example schema verbatim; the exact shape is versioned further by P06-48, a coordinator-approved v2 bump per K318.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "source",
      "global",
      "scenes",
      "missing_capabilities"
    ],
    "properties": {
      "schema_version": {
        "const": 1
      },
      "source": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "asset_ref",
          "checksum",
          "duration_s",
          "ratio",
          "fps"
        ],
        "properties": {
          "asset_ref": {
            "type": "string",
            "minLength": 1
          },
          "checksum": {
            "type": "string",
            "minLength": 1
          },
          "duration_s": {
            "type": "number",
            "exclusiveMinimum": 0
          },
          "ratio": {
            "$ref": "common.schema.json#/$defs/RatioToken"
          },
          "fps": {
            "type": "number",
            "exclusiveMinimum": 0
          }
        }
      },
      "global": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "palette",
          "energy_curve",
          "cuts",
          "holds_s",
          "motion_ratio",
          "camera_grammar",
          "audio"
        ],
        "properties": {
          "palette": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "minItems": 1
          },
          "typography": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "display": {
                "type": "string"
              },
              "body": {
                "type": "string"
              }
            }
          },
          "energy_curve": {
            "type": "array",
            "items": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "minItems": 1
          },
          "cuts": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "hard",
              "velocity_matched",
              "whip"
            ],
            "properties": {
              "hard": {
                "type": "integer",
                "minimum": 0
              },
              "velocity_matched": {
                "type": "integer",
                "minimum": 0
              },
              "whip": {
                "type": "integer",
                "minimum": 0
              }
            }
          },
          "holds_s": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "median",
              "max"
            ],
            "properties": {
              "median": {
                "type": "number",
                "minimum": 0
              },
              "max": {
                "type": "number",
                "minimum": 0
              }
            }
          },
          "motion_ratio": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "camera_grammar": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "audio": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "voiceover"
            ],
            "properties": {
              "music_bpm": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "sfx_events": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "voiceover": {
                "type": "boolean"
              }
            }
          }
        }
      },
      "scenes": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "range_s",
            "role_guess",
            "library_match"
          ],
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
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
            "role_guess": {
              "type": "string",
              "enum": [
                "hook",
                "problem",
                "product_intro",
                "feature",
                "benefit",
                "proof",
                "cta",
                "brand_outro"
              ]
            },
            "layout": {
              "type": "string"
            },
            "elements": {
              "type": "array",
              "items": {
                "type": "object"
              }
            },
            "motion_events": {
              "type": "array",
              "items": {
                "type": "object"
              }
            },
            "camera": {},
            "seam_out": {
              "type": [
                "object",
                "null"
              ],
              "additionalProperties": false,
              "properties": {
                "type": {
                  "type": "string"
                },
                "blur_px": {
                  "type": "number",
                  "minimum": 0
                }
              }
            },
            "library_match": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "blueprint",
                "posture",
                "confidence"
              ],
              "properties": {
                "blueprint": {
                  "$ref": "common.schema.json#/$defs/SemverRevisionRef"
                },
                "posture": {
                  "type": "string",
                  "enum": [
                    "reproduce",
                    "adapt",
                    "compose"
                  ]
                },
                "confidence": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1
                }
              }
            }
          }
        }
      },
      "missing_capabilities": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "brand_entities": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "logo",
                "brand_name",
                "color",
                "product_name"
              ]
            },
            "scene": {
              "type": "string"
            },
            "text": {
              "type": "string"
            }
          }
        }
      }
    }
  },
  "render-worker-node.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/render-worker-node.schema.json",
    "title": "Render worker <-> Workflow render node contract (P00-13 owned)",
    "description": "MOTOR SS3/SS7: the C-motor hot worker pool (frame service, preview compile) and the Workflow final-render node both pin a motion-runtime version and a font set; RenderManifest itself (segmented render, encode, mux) is P00-04's. This schema is the small envelope P00-13 owns: what the worker is asked to seek/render and what it reports back, keyed to composition.render.request (TK-01/TK-19).",
    "$defs": {
      "RenderRequest": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "project_id",
          "revision",
          "ratio",
          "output_profile",
          "motion_runtime_version",
          "font_set_hash"
        ],
        "properties": {
          "project_id": {
            "$ref": "common.schema.json#/$defs/CompositionProjectId"
          },
          "revision": {
            "type": "integer",
            "minimum": 0
          },
          "ratio": {
            "$ref": "common.schema.json#/$defs/RatioToken"
          },
          "mode": {
            "type": "string",
            "enum": [
              "single_frame",
              "preview_compile",
              "final"
            ],
            "default": "single_frame"
          },
          "frame": {
            "$ref": "common.schema.json#/$defs/FrameIndex"
          },
          "output_profile": {
            "type": "string",
            "enum": [
              "spark-export-v1",
              "spark-export-premium-v1"
            ]
          },
          "motion_runtime_version": {
            "type": "string",
            "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
          },
          "font_set_hash": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          },
          "dependency_hash": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$",
            "description": "MOTOR SS3: same revision+frame+dependency_hash reuses the cache; a changed pin never silently reuses a stale render."
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "mode": {
                  "const": "single_frame"
                }
              },
              "required": [
                "mode"
              ]
            },
            "then": {
              "required": [
                "frame"
              ]
            }
          }
        ]
      },
      "RenderResult": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status",
          "motion_runtime_version"
        ],
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "ok",
              "qc_rejected",
              "unavailable_revision",
              "engine_unreachable"
            ]
          },
          "motion_runtime_version": {
            "type": "string",
            "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
          },
          "asset_ref": {
            "type": "string",
            "minLength": 1,
            "description": "PNG (single_frame) or manifest ref (preview_compile|final); the manifest itself is P00-04's RenderManifest."
          },
          "qc_report_ref": {
            "type": "string",
            "minLength": 1
          },
          "reason": {
            "type": "string",
            "minLength": 1
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "status": {
                  "const": "ok"
                }
              },
              "required": [
                "status"
              ]
            },
            "then": {
              "required": [
                "asset_ref"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "status": {
                  "enum": [
                    "qc_rejected",
                    "unavailable_revision",
                    "engine_unreachable"
                  ]
                }
              },
              "required": [
                "status"
              ]
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
    "oneOf": [
      {
        "$ref": "#/$defs/RenderRequest"
      },
      {
        "$ref": "#/$defs/RenderResult"
      }
    ]
  },
  "sketch-spec.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/sketch-spec.schema.json",
    "title": "SketchSpec (Q46, whiteboard/el cizimi anlatim)",
    "description": "The director writes labels and relations, never coordinates (v1); layout is the engine's blueprint layout rule (versus/flow-graph/list/map/callout).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "elements"
    ],
    "properties": {
      "elements": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "slot",
            "entry"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "label",
                "icon_ref",
                "illustration_ref",
                "map_ref",
                "arrow",
                "connector",
                "bracket",
                "mark",
                "value_change"
              ]
            },
            "slot": {
              "type": "string",
              "minLength": 1
            },
            "text": {
              "type": "string",
              "description": "Literal on-screen text; the compiler never rewrites it."
            },
            "source_ref": {
              "type": "string",
              "minLength": 1
            },
            "color_role": {
              "$ref": "common.schema.json#/$defs/ColorRoleToken"
            },
            "relation": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "from_slot": {
                  "type": "string"
                },
                "to_slot": {
                  "type": "string"
                },
                "group": {
                  "type": "string"
                },
                "comparison_side": {
                  "type": "string",
                  "enum": [
                    "left",
                    "right"
                  ]
                },
                "order_index": {
                  "type": "integer",
                  "minimum": 0
                }
              }
            },
            "entry": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "anchor",
                "style"
              ],
              "properties": {
                "anchor": {
                  "$ref": "common.schema.json#/$defs/Anchor"
                },
                "style": {
                  "type": "string",
                  "enum": [
                    "draw",
                    "write",
                    "pop"
                  ]
                }
              }
            }
          }
        }
      }
    }
  },
  "slot-media-request.schema.json": {
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
  "story-beats.schema.json": {
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
  "video-style.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/video-style.schema.json",
    "title": "VideoStyle (Q28, extended by Q54 cut_grammar)",
    "description": "A field of the BrandKit revision (P00-04/Brand owns BrandKit itself); this schema freezes VideoStyle's own shape. Style != Template: Template holds layout/slots, style holds look.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "preset_ref",
      "color_roles",
      "typography_roles",
      "ratio_ramps",
      "motion_temperament",
      "rules",
      "captions_and_logo",
      "cut_grammar"
    ],
    "properties": {
      "preset_ref": {
        "$ref": "common.schema.json#/$defs/SemverRevisionRef"
      },
      "color_roles": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "canvas",
          "surface",
          "ink",
          "muted",
          "accent",
          "contrast_ratio_min"
        ],
        "properties": {
          "canvas": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "surface": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "ink": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "muted": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "accent": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "accent_2": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "gradient": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "minItems": 2
          },
          "contrast_ratio_min": {
            "type": "number",
            "minimum": 1
          }
        }
      },
      "typography_roles": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "display",
          "body"
        ],
        "properties": {
          "display": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "family",
              "weight"
            ],
            "properties": {
              "family": {
                "type": "string",
                "minLength": 1
              },
              "weight": {
                "type": "integer",
                "minimum": 100,
                "maximum": 900
              }
            }
          },
          "body": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "family",
              "weight"
            ],
            "properties": {
              "family": {
                "type": "string",
                "minLength": 1
              },
              "weight": {
                "type": "integer",
                "minimum": 100,
                "maximum": 900
              }
            }
          },
          "mono": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "family",
              "weight"
            ],
            "properties": {
              "family": {
                "type": "string",
                "minLength": 1
              },
              "weight": {
                "type": "integer",
                "minimum": 100,
                "maximum": 900
              }
            }
          }
        }
      },
      "ratio_ramps": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ratio",
            "scale_unit"
          ],
          "properties": {
            "ratio": {
              "$ref": "common.schema.json#/$defs/RatioToken"
            },
            "scale_unit": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        }
      },
      "component_tokens": {
        "type": "object",
        "additionalProperties": {
          "type": "string"
        }
      },
      "motion_temperament": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "default_energy",
          "ease_family"
        ],
        "properties": {
          "default_energy": {
            "$ref": "common.schema.json#/$defs/Energy"
          },
          "ease_family": {
            "type": "string",
            "minLength": 1
          },
          "overshoot_allowed": {
            "type": "boolean"
          }
        }
      },
      "rules": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        },
        "description": "Do/don't preset rules, e.g. 'tek vurgu', 'golge yok'."
      },
      "captions_and_logo": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "caption_skin",
          "logo_safe_area"
        ],
        "properties": {
          "caption_skin": {
            "type": "string",
            "minLength": 1
          },
          "logo_safe_area": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "margin_pct"
            ],
            "properties": {
              "margin_pct": {
                "type": "number",
                "minimum": 0,
                "maximum": 50
              }
            }
          }
        }
      },
      "cut_grammar": {
        "type": "string",
        "enum": [
          "flow",
          "beat_cut",
          "mixed"
        ],
        "description": "Q54 SS2.4: flow (default doctrine 6), beat_cut (hard cuts allowed, +-1 frame to beat, >=8 frames between cuts), mixed (per-section, boundaries in storyboard)."
      }
    }
  }
} as const;

// Foreign schema files reached through cross-package $refs, embedded verbatim
// from their owner package and registered next to SCHEMAS.
export const DEPENDENCY_SCHEMAS = {
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

export const DOCUMENT_TYPES = ["annotation-cue", "audio-mix-plan", "content-package-manifest", "edit-context", "edit-op", "edit-receipt", "focus-cue", "motion-blueprint-manifest", "motion-shot-spec", "presenter-layout", "reference-analysis", "render-worker-node", "sketch-spec", "slot-media-request", "story-beats", "video-style"] as const;
export type DocumentType = "annotation-cue" | "audio-mix-plan" | "content-package-manifest" | "edit-context" | "edit-op" | "edit-receipt" | "focus-cue" | "motion-blueprint-manifest" | "motion-shot-spec" | "presenter-layout" | "reference-analysis" | "render-worker-node" | "sketch-spec" | "slot-media-request" | "story-beats" | "video-style";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "reference-analysis": [
    1
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "content-package-manifest": {
    "status": [
      "active",
      "degraded",
      "disabled",
      "maintenance"
    ]
  },
  "edit-receipt": {
    "status": [
      "applied",
      "failed",
      "refused",
      "saved",
      "verified"
    ]
  },
  "render-worker-node": {
    "status": [
      "engine_unreachable",
      "ok",
      "qc_rejected",
      "unavailable_revision"
    ]
  }
};

export type AnnotationCue = {
    readonly "target": ({
    readonly "asset_ref": string;
    readonly "region": {
    readonly "x": number;
    readonly "y": number;
    readonly "w": number;
    readonly "h": number;
  };
  }) | ({
    readonly "handle": string;
  }) | ({
    readonly "ocr_span_id": string;
  });
    readonly "type": "circle" | "box" | "underline" | "highlight" | "strike" | "arrow_to" | "bracket" | "replace";
    readonly "replace"?: {
    readonly "old": string;
    readonly "new": string;
  };
    readonly "anchor": unknown;
    readonly "evidence_refs"?: readonly (string)[];
    readonly "confidence_band"?: "high" | "medium" | "low";
    readonly "timing": {
    readonly "draw_lead_ms": 100;
    readonly "hold_max_s": number;
    readonly "exit_s": 0.25;
  };
  };
export type AudioMixPlan = {
    readonly "buses": {
    readonly "voice"?: unknown;
    readonly "source_dialogue"?: unknown;
    readonly "music"?: unknown;
    readonly "sfx"?: unknown;
    readonly "ambience"?: unknown;
  };
    readonly "ducking": {
    readonly "depth_db": number;
    readonly "attack_ms": number;
    readonly "release_ms": number;
  };
    readonly "background_level_offset_db"?: number;
    readonly "automation_envelopes"?: readonly ({
    readonly "bus": "voice" | "source_dialogue" | "music" | "sfx" | "ambience";
    readonly "start_s": number;
    readonly "end_s": number;
    readonly "gain_db": number;
    readonly "ramp_ms"?: number;
  })[];
    readonly "final_target": {
    readonly "lufs": -14;
    readonly "true_peak_dbtp": number;
  };
  };
export type ContentPackageManifest = {
    readonly "id_revision": string;
    readonly "required_core_parts": readonly ({
    readonly "part": "text" | "shape_path" | "media" | "mask" | "camera" | "particle_physics" | "ease_registry" | "morph" | "layout_solver" | "render" | "qc";
    readonly "version_range": string;
  })[];
    readonly "patterns"?: readonly (string)[];
    readonly "guide_ref": string;
    readonly "supported_ratios": readonly ("16:9" | "9:16" | "1:1")[];
    readonly "eval_set_ref"?: string;
    readonly "eval_thresholds"?: Record<string, unknown>;
    readonly "fallback_chain": readonly (string)[];
    readonly "owner": string;
    readonly "status": "active" | "degraded" | "maintenance" | "disabled";
  };
export type EditContext = {
    readonly "project_id": unknown;
    readonly "base_revision": number;
    readonly "playhead_frame": number;
    readonly "selection"?: {
    readonly "scene_id"?: string;
    readonly "layer_ids"?: readonly (string)[];
    readonly "handles"?: readonly (string)[];
    readonly "slot_ids"?: readonly (string)[];
  };
    readonly "region"?: ({
    readonly "frame": number;
    readonly "box": {
    readonly "x": number;
    readonly "y": number;
    readonly "w": number;
    readonly "h": number;
  };
  }) | ({
    readonly "frame": number;
    readonly "free_mark": readonly ({
    readonly "x": number;
    readonly "y": number;
  })[];
  });
    readonly "time_range"?: {
    readonly "start_frame": number;
    readonly "end_frame": number;
  };
    readonly "locale"?: string;
  };
export type EditOp = {
    readonly "op": "setText" | "setColorToken" | "setMedia" | "setDuration" | "setEnergy" | "swapBlueprint" | "setPresentation" | "setStyle" | "transform" | "move" | "reorder" | "hide" | "remove" | "addKitComponent" | "setTiming" | "shift" | "retimeScene" | "setHold" | "setAnchor" | "addTween" | "setTween" | "removeTween" | "addKeyframe" | "setKeyframe" | "removeKeyframe" | "convertToKeyframes" | "splitTween" | "setCameraPhase" | "addCameraMove" | "setFocusTarget" | "setSeam" | "setTransition" | "setThumbnailFrame";
    readonly "target_handle": string;
    readonly "expected_version": number;
    readonly "read_set": readonly (string)[];
    readonly "params": Record<string, unknown>;
    readonly "inverse"?: unknown;
  };
export type EditReceipt = {
    readonly "status": "refused" | "applied" | "saved" | "verified" | "failed";
    readonly "actor": string;
    readonly "origin": "user" | "agent" | "system";
    readonly "op_count": number;
    readonly "undo_group_id"?: string;
    readonly "reason"?: string;
    readonly "revision_before"?: number;
    readonly "revision_after"?: number;
    readonly "qc_passed"?: boolean;
    readonly "conflicts"?: readonly ({
    readonly "handle": string;
    readonly "kind": "version_mismatch" | "handle_missing" | "handle_type_changed";
  })[];
  };
export type FocusCue = {
    readonly "range": unknown;
    readonly "target": "speaker" | "full_media" | "media_region" | "overlay";
    readonly "presentation"?: "side_card" | "split" | "pip_camera" | "cutaway" | "interstitial";
    readonly "shot": "full" | "zoom_to" | "pan_to" | "push";
    readonly "scale"?: number;
    readonly "reason"?: string;
    readonly "evidence_refs"?: readonly (string)[];
    readonly "confidence_band"?: "high" | "medium" | "low";
    readonly "decided_by": "rule" | "llm" | "user";
    readonly "locked": boolean;
  };
export type MotionBlueprintManifest = {
    readonly "id_revision": string;
    readonly "roles": readonly ("hook" | "problem" | "product_intro" | "feature" | "benefit" | "proof" | "cta" | "brand_outro")[];
    readonly "duration_range": {
    readonly "min_frames": number;
    readonly "max_frames": number;
  };
    readonly "slot_schema": readonly ({
    readonly "slot_id": string;
    readonly "kind": "text" | "media" | "number" | "list";
    readonly "max_length"?: number;
    readonly "overflow_policy"?: "shrink_then_wrap" | "wrap" | "truncate_suggestion";
    readonly "media_ratio"?: "16:9" | "9:16" | "1:1";
    readonly "list_cardinality"?: {
    readonly "min"?: number;
    readonly "max"?: number;
  };
  })[];
    readonly "signature_move": string;
    readonly "window_template"?: string;
    readonly "ratio_variants": readonly ("16:9" | "9:16" | "1:1")[];
    readonly "energy_variants": readonly ({
    readonly "energy": "sakin" | "dengeli" | "canli";
    readonly "time_scale": number;
    readonly "ease_family": string;
    readonly "blur_allowed"?: boolean;
    readonly "overshoot_allowed"?: boolean;
  })[];
    readonly "seam_contract": {
    readonly "seam_in": "zoom_through" | "reverse_zoom_through" | "direction_matched_cut" | "word_wave_cut" | "blur_crossfade" | "push_slide" | "hard_cut" | "none";
    readonly "seam_out": "zoom_through" | "reverse_zoom_through" | "direction_matched_cut" | "word_wave_cut" | "blur_crossfade" | "push_slide" | "hard_cut" | "none";
  };
    readonly "sfx_cue_points"?: readonly ("whoosh" | "click" | "typing" | "pop" | "hit" | "riser" | "ui-notify" | "transition")[];
    readonly "uses_recipes"?: readonly (string)[];
    readonly "alternatives"?: readonly (string)[];
    readonly "adaptation": "native" | "rule_adapted" | "model_adapted" | "manual_review";
    readonly "loop_capable": boolean;
    readonly "component_class": "content" | "chrome";
    readonly "style_bindings"?: readonly (string)[];
  };
export type MotionShotSpec = {
    readonly "blueprint_ref": string;
    readonly "posture": "reproduce" | "adapt" | "compose";
    readonly "slots": readonly ({
    readonly "slot_id": string;
    readonly "kind": "text" | "media" | "number" | "list";
    readonly "value": unknown;
    readonly "overflow_policy"?: "shrink_then_wrap" | "wrap" | "truncate_suggestion";
  })[];
    readonly "windows": readonly ({
    readonly "slot_id": string;
    readonly "anchor": unknown;
    readonly "move": string;
  })[];
    readonly "camera"?: readonly ({
    readonly "phase": "push" | "pan" | "zoom_to_target" | "pull_back" | "static";
    readonly "focus_region_ref"?: string;
  })[];
    readonly "seam_in"?: {
    readonly "type": "zoom_through" | "reverse_zoom_through" | "direction_matched_cut" | "word_wave_cut" | "blur_crossfade" | "push_slide" | "hard_cut" | "none";
    readonly "carry_over_handle"?: string;
  };
    readonly "seam_out"?: {
    readonly "type": "zoom_through" | "reverse_zoom_through" | "direction_matched_cut" | "word_wave_cut" | "blur_crossfade" | "push_slide" | "hard_cut" | "none";
    readonly "carry_over_handle"?: string;
  };
    readonly "energy": "sakin" | "dengeli" | "canli";
    readonly "sfx_cues"?: readonly ("whoosh" | "click" | "typing" | "pop" | "hit" | "riser" | "ui-notify" | "transition")[];
    readonly "ratio": "16:9" | "9:16" | "1:1";
  };
export type PresenterLayout = {
    readonly "pattern": "full" | "pip" | "cam_card_plus_content" | "cutout_over_content" | "split_2" | "split_3" | "grid_4" | "content_only" | "interstitial";
    readonly "pip_config"?: {
    readonly "corner"?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
    readonly "shape"?: "circle" | "rounded_rect";
    readonly "size_pct"?: number;
  };
    readonly "regions": readonly ({
    readonly "ratio": "16:9" | "9:16" | "1:1";
    readonly "name": "content" | "camera" | "caption_zone" | "lower_third" | "corner_badge" | "cta";
    readonly "camera_index"?: number;
    readonly "box": {
    readonly "x": number;
    readonly "y": number;
    readonly "w": number;
    readonly "h": number;
  };
  })[];
    readonly "transition_ms": number;
    readonly "camera_frame_token"?: string;
  };
export type ReferenceAnalysis = {
    readonly "schema_version": 1;
    readonly "source": {
    readonly "asset_ref": string;
    readonly "checksum": string;
    readonly "duration_s": number;
    readonly "ratio": "16:9" | "9:16" | "1:1";
    readonly "fps": number;
  };
    readonly "global": {
    readonly "palette": readonly (string)[];
    readonly "typography"?: {
    readonly "display"?: string;
    readonly "body"?: string;
  };
    readonly "energy_curve": readonly (number)[];
    readonly "cuts": {
    readonly "hard": number;
    readonly "velocity_matched": number;
    readonly "whip": number;
  };
    readonly "holds_s": {
    readonly "median": number;
    readonly "max": number;
  };
    readonly "motion_ratio": number;
    readonly "camera_grammar": readonly (string)[];
    readonly "audio": {
    readonly "music_bpm"?: number;
    readonly "sfx_events"?: readonly (string)[];
    readonly "voiceover": boolean;
  };
  };
    readonly "scenes": readonly ({
    readonly "id": string;
    readonly "range_s": readonly (number)[];
    readonly "role_guess": "hook" | "problem" | "product_intro" | "feature" | "benefit" | "proof" | "cta" | "brand_outro";
    readonly "layout"?: string;
    readonly "elements"?: readonly (Record<string, unknown>)[];
    readonly "motion_events"?: readonly (Record<string, unknown>)[];
    readonly "camera"?: unknown;
    readonly "seam_out"?: {
    readonly "type"?: string;
    readonly "blur_px"?: number;
  } | null;
    readonly "library_match": {
    readonly "blueprint": string;
    readonly "posture": "reproduce" | "adapt" | "compose";
    readonly "confidence": number;
  };
  })[];
    readonly "missing_capabilities": readonly (string)[];
    readonly "brand_entities"?: readonly ({
    readonly "kind": "logo" | "brand_name" | "color" | "product_name";
    readonly "scene"?: string;
    readonly "text"?: string;
  })[];
  };
export type RenderWorkerNode = (unknown);
export type SketchSpec = {
    readonly "elements": readonly ({
    readonly "kind": "label" | "icon_ref" | "illustration_ref" | "map_ref" | "arrow" | "connector" | "bracket" | "mark" | "value_change";
    readonly "slot": string;
    readonly "text"?: string;
    readonly "source_ref"?: string;
    readonly "color_role"?: "canvas" | "surface" | "ink" | "muted" | "accent" | "accent-2" | "gradient";
    readonly "relation"?: {
    readonly "from_slot"?: string;
    readonly "to_slot"?: string;
    readonly "group"?: string;
    readonly "comparison_side"?: "left" | "right";
    readonly "order_index"?: number;
  };
    readonly "entry": {
    readonly "anchor": unknown;
    readonly "style": "draw" | "write" | "pop";
  };
  })[];
  };
export type SlotMediaRequest = {
    readonly "slot_id": string;
    readonly "purpose": "atmosphere" | "usage_moment" | "background" | "product_screen";
    readonly "prompt"?: string;
    readonly "reference_asset_refs"?: readonly (string)[];
    readonly "target": {
    readonly "ratio": "16:9" | "9:16" | "1:1";
    readonly "duration_s": number;
    readonly "motion_need": "static" | "camera" | "subject";
  };
    readonly "time_policy": "hold_last_frame" | "trim_slot" | "reject";
    readonly "representational"?: boolean;
  };
export type StoryBeats = {
    readonly "message": string;
    readonly "beats": readonly ({
    readonly "beat": "hook" | "reveal" | "feature_loop" | "proof" | "breather" | "cta";
    readonly "range_s": readonly (number)[];
    readonly "notes"?: string;
  })[];
    readonly "shareable_frame_s"?: number;
  };
export type VideoStyle = {
    readonly "preset_ref": string;
    readonly "color_roles": {
    readonly "canvas": string;
    readonly "surface": string;
    readonly "ink": string;
    readonly "muted": string;
    readonly "accent": string;
    readonly "accent_2"?: string;
    readonly "gradient"?: readonly (string)[];
    readonly "contrast_ratio_min": number;
  };
    readonly "typography_roles": {
    readonly "display": {
    readonly "family": string;
    readonly "weight": number;
  };
    readonly "body": {
    readonly "family": string;
    readonly "weight": number;
  };
    readonly "mono"?: {
    readonly "family": string;
    readonly "weight": number;
  };
  };
    readonly "ratio_ramps": readonly ({
    readonly "ratio": "16:9" | "9:16" | "1:1";
    readonly "scale_unit": number;
  })[];
    readonly "component_tokens"?: Record<string, unknown>;
    readonly "motion_temperament": {
    readonly "default_energy": "sakin" | "dengeli" | "canli";
    readonly "ease_family": string;
    readonly "overshoot_allowed"?: boolean;
  };
    readonly "rules": readonly (string)[];
    readonly "captions_and_logo": {
    readonly "caption_skin": string;
    readonly "logo_safe_area": {
    readonly "margin_pct": number;
  };
  };
    readonly "cut_grammar": "flow" | "beat_cut" | "mixed";
  };

export const reader = new ContractPackageReader({
  package: "motion-spark",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
