// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/reference-analysis/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/reference-analysis/v1/common.schema.json",
    "title": "reference_analysis_common_v1",
    "description": "Shared definitions for P06-48 reference analysis and Clone (KARAR-REFERANS-KLON-VE-AVATAR-ARKA-PLAN section 1, Q41, Q98): the measured facts of a reference video, the clone request, the clone plan and the round comparison. Not a standalone document type. The finished ReferenceAnalysis (scene to library mapping) is motion-spark v1 reference-analysis.schema.json, unchanged.",
    "$defs": {
      "Sha256": {
        "type": "string",
        "pattern": "^[0-9a-f]{64}$"
      },
      "SceneId": {
        "type": "string",
        "pattern": "^s[0-9]{1,3}$"
      },
      "HexColor": {
        "type": "string",
        "pattern": "^#[0-9A-F]{6}$"
      },
      "Seconds": {
        "type": "number",
        "minimum": 0,
        "maximum": 100000
      },
      "Unit": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      },
      "SeamType": {
        "description": "hard = no motion continuity; velocity_matched = moving on both sides at a similar speed; whip = motion smear (blur) at the seam; dissolve = a cross-fade between two settled pictures.",
        "enum": [
          "hard",
          "velocity_matched",
          "whip",
          "dissolve"
        ]
      },
      "CameraKind": {
        "description": "Names the camera: content sliding right = pan_left, content sliding down = tilt_up, expanding content = push_in.",
        "enum": [
          "static",
          "push_in",
          "pull_out",
          "pan_left",
          "pan_right",
          "tilt_up",
          "tilt_down",
          "mixed"
        ]
      },
      "Mode": {
        "description": "exact = birebir yapi (default); style = stil klonu; inspiration = esinlenme / daha ozgun (Q41, Q98).",
        "enum": [
          "exact",
          "style",
          "inspiration"
        ]
      },
      "SfxShape": {
        "description": "Named by its measured shape only: no sound classifier runs in the analysis.",
        "enum": [
          "transient",
          "swell"
        ]
      },
      "SfxKind": {
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
      },
      "StorageObjectRef": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
      },
      "RatioToken": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/RatioToken"
      },
      "SemverRevisionRef": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/motion-spark/v1/common.schema.json#/$defs/SemverRevisionRef"
      },
      "PartAspect": {
        "description": "The facet of a scene (or of the whole video) a part-level request touches.",
        "enum": [
          "structure",
          "blueprint",
          "palette",
          "typography",
          "camera",
          "seam",
          "text",
          "media",
          "audio"
        ]
      },
      "PartAction": {
        "description": "different = redesign that facet; brand = take it from the Brand Kit (palette, typography, text, media only); keep = preserve the reference's facet.",
        "enum": [
          "different",
          "brand",
          "keep"
        ]
      },
      "SeamTarget": {
        "description": "The blueprint seam vocabulary (motion-spark motion-blueprint-manifest seam_contract).",
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
      "MissingCapabilityAction": {
        "description": "l1_line = a code line the user can decline (Q40); nearest_blueprint = the closest blueprint is used and the difference is written in the plan.",
        "enum": [
          "l1_line",
          "nearest_blueprint"
        ]
      }
    }
  },
  "reference-clone-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/reference-analysis/v1/reference-clone-plan.schema.json",
    "title": "reference_clone_plan_v1",
    "description": "The deterministic plan skeleton of a clone (KARAR-REFERANS section 1.4, K289): what the ReferenceAnalysis, the clone mode, the part-level requests and the Brand Kit make of each scene (kept, adapted, composed from parts or redesigned), the brand replacements, the audio intents (music and effects are searched or created, never copied) and the capabilities the library lacks (each a declinable L1 line or the nearest blueprint). Pins the exact facts and analysis by digest. It is a plan source, not a storyboard: copy, media and timing edits belong to the normal plan.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "mode",
      "analysis",
      "target",
      "scenes",
      "brand",
      "audio",
      "missing_capabilities",
      "gaps",
      "iteration"
    ],
    "properties": {
      "schema_version": {
        "const": "reference_clone_plan_v1"
      },
      "mode": {
        "$ref": "common.schema.json#/$defs/Mode"
      },
      "analysis": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "facts_sha256",
          "analysis_sha256"
        ],
        "properties": {
          "facts_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          },
          "analysis_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "target": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ratio",
          "fps"
        ],
        "properties": {
          "ratio": {
            "$ref": "common.schema.json#/$defs/RatioToken"
          },
          "fps": {
            "type": "number",
            "minimum": 12,
            "maximum": 60
          }
        }
      },
      "scenes": {
        "type": "array",
        "minItems": 1,
        "maxItems": 256,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "scene_id",
            "range_s",
            "duration_frames",
            "treatment",
            "blueprint",
            "confidence",
            "seam_out",
            "camera",
            "pinned_by_user"
          ],
          "properties": {
            "scene_id": {
              "$ref": "common.schema.json#/$defs/SceneId"
            },
            "range_s": {
              "type": "array",
              "minItems": 2,
              "maxItems": 2,
              "items": {
                "$ref": "common.schema.json#/$defs/Seconds"
              }
            },
            "duration_frames": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100000
            },
            "treatment": {
              "description": "reproduce/adapt/compose follow the library match posture; redesign = a part request or the clone mode asked for a new design of this scene.",
              "enum": [
                "reproduce",
                "adapt",
                "compose",
                "redesign"
              ]
            },
            "blueprint": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "$ref": "common.schema.json#/$defs/SemverRevisionRef"
                }
              ]
            },
            "confidence": {
              "$ref": "common.schema.json#/$defs/Unit"
            },
            "seam_out": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "source",
                "target"
              ],
              "properties": {
                "source": {
                  "oneOf": [
                    {
                      "type": "null"
                    },
                    {
                      "$ref": "common.schema.json#/$defs/SeamType"
                    }
                  ]
                },
                "target": {
                  "oneOf": [
                    {
                      "type": "null"
                    },
                    {
                      "$ref": "common.schema.json#/$defs/SeamTarget"
                    }
                  ]
                }
              }
            },
            "camera": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "source",
                "action"
              ],
              "properties": {
                "source": {
                  "$ref": "common.schema.json#/$defs/CameraKind"
                },
                "action": {
                  "enum": [
                    "keep",
                    "drop"
                  ]
                }
              }
            },
            "pinned_by_user": {
              "type": "boolean",
              "description": "A part-level keep pins this scene's reference facets."
            }
          }
        }
      },
      "brand": {
        "type": "array",
        "maxItems": 32,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "entity",
            "source",
            "scene_id"
          ],
          "properties": {
            "entity": {
              "enum": [
                "logo",
                "brand_name",
                "product_name",
                "color",
                "typography",
                "product_screens"
              ]
            },
            "source": {
              "enum": [
                "brand_kit",
                "user_asset",
                "neutral_default",
                "adapt_to_product",
                "reference"
              ]
            },
            "scene_id": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "$ref": "common.schema.json#/$defs/SceneId"
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
          "music",
          "sfx",
          "voiceover_in_reference"
        ],
        "properties": {
          "music": {
            "oneOf": [
              {
                "type": "null",
                "description": "The reference has no audio or is silent: no music intent is derived."
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "source",
                  "bpm",
                  "energy",
                  "copy_reference"
                ],
                "properties": {
                  "source": {
                    "enum": [
                      "stock_search",
                      "stock_create"
                    ]
                  },
                  "bpm": {
                    "oneOf": [
                      {
                        "type": "null"
                      },
                      {
                        "type": "number",
                        "minimum": 60,
                        "maximum": 200
                      }
                    ]
                  },
                  "energy": {
                    "enum": [
                      "low",
                      "medium",
                      "high"
                    ]
                  },
                  "copy_reference": {
                    "const": false,
                    "description": "The reference's music is never copied."
                  }
                }
              }
            ]
          },
          "sfx": {
            "type": "array",
            "maxItems": 32,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "t",
                "shape",
                "kind_candidates"
              ],
              "properties": {
                "t": {
                  "$ref": "common.schema.json#/$defs/Seconds"
                },
                "shape": {
                  "$ref": "common.schema.json#/$defs/SfxShape"
                },
                "kind_candidates": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 8,
                  "uniqueItems": true,
                  "items": {
                    "$ref": "common.schema.json#/$defs/SfxKind"
                  }
                }
              }
            }
          },
          "voiceover_in_reference": {
            "type": "boolean"
          }
        }
      },
      "missing_capabilities": {
        "type": "array",
        "maxItems": 64,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "code",
            "scene_id",
            "action"
          ],
          "properties": {
            "code": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]*(:[A-Za-z0-9_.-]+)?$",
              "maxLength": 96
            },
            "scene_id": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "$ref": "common.schema.json#/$defs/SceneId"
                }
              ]
            },
            "action": {
              "$ref": "common.schema.json#/$defs/MissingCapabilityAction"
            }
          }
        }
      },
      "gaps": {
        "type": "array",
        "maxItems": 8,
        "uniqueItems": true,
        "items": {
          "description": "Analysis steps that did not run or a window that was not analysed: what is not measured is not claimed.",
          "enum": [
            "typography_not_measured",
            "text_not_measured",
            "elements_not_measured",
            "logo_not_detected",
            "analysis_truncated"
          ]
        }
      },
      "iteration": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "max_rounds",
          "targets"
        ],
        "properties": {
          "max_rounds": {
            "type": "integer",
            "minimum": 0,
            "maximum": 5
          },
          "targets": {
            "type": "array",
            "maxItems": 300,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "metric",
                "scene_id",
                "absolute",
                "unit"
              ],
              "properties": {
                "metric": {
                  "enum": [
                    "scene_duration",
                    "hold_median",
                    "palette",
                    "motion_ratio",
                    "tempo"
                  ]
                },
                "scene_id": {
                  "oneOf": [
                    {
                      "type": "null"
                    },
                    {
                      "$ref": "common.schema.json#/$defs/SceneId"
                    }
                  ]
                },
                "absolute": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100000
                },
                "unit": {
                  "enum": [
                    "s",
                    "delta_e",
                    "ratio",
                    "bpm"
                  ]
                }
              }
            }
          }
        }
      }
    }
  },
  "reference-clone-request.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/reference-analysis/v1/reference-clone-request.schema.json",
    "title": "reference_clone_request_v1",
    "description": "The explicit Clone intent (KARAR-REFERANS section 1.4, Q41, Q98): the mode (default exact structure), the user's declaration that the reference may serve as a style source, what the user's Brand Kit and assets can supply, the target canvas, part-level requests (only that part changes) and the iteration budget. Cloning is a separate feature with explicit user intent; an ordinary upload never triggers it (Q15 6A).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "mode",
      "style_source_declared",
      "brand",
      "target",
      "part_overrides",
      "iteration"
    ],
    "properties": {
      "schema_version": {
        "const": "reference_clone_request_v1"
      },
      "mode": {
        "$ref": "common.schema.json#/$defs/Mode"
      },
      "style_source_declared": {
        "const": true,
        "description": "The user declared the reference may be used as a style source (a request without it is refused, never assumed)."
      },
      "brand": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kit_available",
          "logo_available",
          "product_assets_available"
        ],
        "properties": {
          "kit_available": {
            "type": "boolean"
          },
          "logo_available": {
            "type": "boolean"
          },
          "product_assets_available": {
            "type": "boolean"
          }
        }
      },
      "target": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ratio",
          "fps"
        ],
        "properties": {
          "ratio": {
            "$ref": "common.schema.json#/$defs/RatioToken"
          },
          "fps": {
            "type": "number",
            "minimum": 12,
            "maximum": 60
          }
        }
      },
      "part_overrides": {
        "type": "array",
        "maxItems": 32,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "scene_id",
            "aspect",
            "action"
          ],
          "properties": {
            "scene_id": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "$ref": "common.schema.json#/$defs/SceneId"
                }
              ]
            },
            "aspect": {
              "$ref": "common.schema.json#/$defs/PartAspect"
            },
            "action": {
              "$ref": "common.schema.json#/$defs/PartAction"
            }
          },
          "if": {
            "properties": {
              "action": {
                "const": "brand"
              }
            },
            "required": [
              "action"
            ]
          },
          "then": {
            "properties": {
              "aspect": {
                "enum": [
                  "palette",
                  "typography",
                  "text",
                  "media"
                ]
              }
            }
          }
        }
      },
      "iteration": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "max_rounds"
        ],
        "properties": {
          "max_rounds": {
            "type": "integer",
            "minimum": 0,
            "maximum": 5
          }
        }
      }
    }
  },
  "reference-comparison.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/reference-analysis/v1/reference-comparison.schema.json",
    "title": "reference_comparison_v1",
    "description": "Round comparison of a clone preview against its reference (K290): both are reference_facts_v1 documents measured by the same node. Reports the cut times (per scene, in frames), scene durations, the median hold, the palette difference (CIE76 delta E), the motion curve difference and the tempo, each against a tolerance, and lists what remains with the absolute target that would fix it. At most iteration.max_rounds rounds run; what still differs after the last round stays visible in the plan.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "round",
      "reference",
      "candidate",
      "tolerances",
      "scenes",
      "counts",
      "holds",
      "palette",
      "motion",
      "tempo",
      "converged",
      "remaining"
    ],
    "properties": {
      "schema_version": {
        "const": "reference_comparison_v1"
      },
      "round": {
        "type": "integer",
        "minimum": 1,
        "maximum": 5
      },
      "reference": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "facts_sha256"
        ],
        "properties": {
          "facts_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "candidate": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "facts_sha256"
        ],
        "properties": {
          "facts_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "tolerances": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "cut_frames",
          "hold_s",
          "palette_delta_e",
          "motion_curve_rmse",
          "bpm"
        ],
        "properties": {
          "cut_frames": {
            "type": "integer",
            "minimum": 0,
            "maximum": 30
          },
          "hold_s": {
            "type": "number",
            "minimum": 0,
            "maximum": 10
          },
          "palette_delta_e": {
            "type": "number",
            "minimum": 0,
            "maximum": 100
          },
          "motion_curve_rmse": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "bpm": {
            "type": "number",
            "minimum": 0,
            "maximum": 50
          }
        }
      },
      "scenes": {
        "type": "array",
        "maxItems": 256,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "scene_id",
            "reference_range_s",
            "candidate_range_s",
            "cut_delta_frames",
            "duration_delta_s",
            "within"
          ],
          "properties": {
            "scene_id": {
              "$ref": "common.schema.json#/$defs/SceneId"
            },
            "reference_range_s": {
              "type": "array",
              "minItems": 2,
              "maxItems": 2,
              "items": {
                "$ref": "common.schema.json#/$defs/Seconds"
              }
            },
            "candidate_range_s": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "type": "array",
                  "minItems": 2,
                  "maxItems": 2,
                  "items": {
                    "$ref": "common.schema.json#/$defs/Seconds"
                  }
                }
              ]
            },
            "cut_delta_frames": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "type": "integer",
                  "minimum": -100000,
                  "maximum": 100000
                }
              ]
            },
            "duration_delta_s": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "type": "number",
                  "minimum": -100000,
                  "maximum": 100000
                }
              ]
            },
            "within": {
              "type": "boolean"
            }
          }
        }
      },
      "counts": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "reference_scenes",
          "candidate_scenes"
        ],
        "properties": {
          "reference_scenes": {
            "type": "integer",
            "minimum": 1
          },
          "candidate_scenes": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "holds": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "reference_median_s",
          "candidate_median_s",
          "delta_s",
          "within"
        ],
        "properties": {
          "reference_median_s": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "candidate_median_s": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "delta_s": {
            "type": "number",
            "minimum": -100000,
            "maximum": 100000
          },
          "within": {
            "type": "boolean"
          }
        }
      },
      "palette": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "delta_e_mean",
          "within"
        ],
        "properties": {
          "delta_e_mean": {
            "type": "number",
            "minimum": 0,
            "maximum": 200
          },
          "within": {
            "type": "boolean"
          }
        }
      },
      "motion": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "curve_rmse",
          "motion_ratio_delta",
          "within"
        ],
        "properties": {
          "curve_rmse": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "motion_ratio_delta": {
            "type": "number",
            "minimum": -1,
            "maximum": 1
          },
          "within": {
            "type": "boolean"
          }
        }
      },
      "tempo": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "reference_bpm",
              "candidate_bpm",
              "delta_bpm",
              "within"
            ],
            "properties": {
              "reference_bpm": {
                "type": "number",
                "minimum": 60,
                "maximum": 200
              },
              "candidate_bpm": {
                "oneOf": [
                  {
                    "type": "null",
                    "description": "The candidate has no measurable tempo (no music yet): never within tolerance."
                  },
                  {
                    "type": "number",
                    "minimum": 60,
                    "maximum": 200
                  }
                ]
              },
              "delta_bpm": {
                "oneOf": [
                  {
                    "type": "null"
                  },
                  {
                    "type": "number",
                    "minimum": -200,
                    "maximum": 200
                  }
                ]
              },
              "within": {
                "type": "boolean"
              }
            }
          }
        ],
        "description": "null when the reference has no measurable tempo; when it has one, candidate_bpm/delta_bpm are null while the candidate has none (within is false and the remaining list names the absolute target)."
      },
      "converged": {
        "type": "boolean"
      },
      "remaining": {
        "type": "array",
        "maxItems": 520,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "metric",
            "scene_id",
            "delta",
            "absolute_target"
          ],
          "properties": {
            "metric": {
              "enum": [
                "scene_duration",
                "cut_time",
                "scene_count",
                "hold_median",
                "palette",
                "motion_curve",
                "tempo"
              ]
            },
            "scene_id": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "$ref": "common.schema.json#/$defs/SceneId"
                }
              ]
            },
            "delta": {
              "type": "number",
              "minimum": -100000,
              "maximum": 100000
            },
            "absolute_target": {
              "type": "number",
              "minimum": 0,
              "maximum": 100000
            }
          }
        }
      }
    }
  },
  "reference-facts.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/reference-analysis/v1/reference-facts.schema.json",
    "title": "reference_facts_v1",
    "description": "reference_analyze@1 result (KARAR-REFERANS section 1.2): the deterministic facts measured on a reference video - shots and seams, motion profile, holds, camera grammar, palette and audio facts. Only what a measurement supports is here: typography, OCR text and element classes come from model steps that this node does not run (listed as skipped steps). The scene to library mapping is not here (Composition maps facts to the motion-spark ReferenceAnalysis). The reference's pixels and music are never carried.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "source",
      "analysis",
      "shots",
      "global",
      "audio"
    ],
    "properties": {
      "schema_version": {
        "const": "reference_facts_v1"
      },
      "source": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "asset",
          "duration_s",
          "width",
          "height",
          "fps",
          "has_audio"
        ],
        "properties": {
          "asset": {
            "$ref": "common.schema.json#/$defs/StorageObjectRef"
          },
          "duration_s": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 86400
          },
          "width": {
            "type": "integer",
            "minimum": 16,
            "maximum": 16384
          },
          "height": {
            "type": "integer",
            "minimum": 16,
            "maximum": 16384
          },
          "fps": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 240
          },
          "has_audio": {
            "type": "boolean"
          }
        }
      },
      "analysis": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "revision",
          "rules_revision",
          "sample_fps",
          "frames_analyzed",
          "analyzed_seconds",
          "truncated",
          "steps"
        ],
        "properties": {
          "revision": {
            "type": "string",
            "pattern": "^reference-facts-r[0-9]+$"
          },
          "rules_revision": {
            "type": "integer",
            "minimum": 1
          },
          "sample_fps": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 30
          },
          "frames_analyzed": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3000
          },
          "analyzed_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 100
          },
          "truncated": {
            "type": "boolean",
            "description": "true = the source is longer than the analyzed window (only the first analyzed_seconds were measured)."
          },
          "steps": {
            "type": "array",
            "minItems": 8,
            "maxItems": 8,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "step",
                "status"
              ],
              "properties": {
                "step": {
                  "enum": [
                    "probe",
                    "shots",
                    "motion",
                    "camera",
                    "palette",
                    "audio",
                    "typography",
                    "elements"
                  ]
                },
                "status": {
                  "enum": [
                    "measured",
                    "skipped"
                  ]
                },
                "reason": {
                  "enum": [
                    "model_step_not_run",
                    "no_audio_stream"
                  ]
                }
              }
            }
          }
        }
      },
      "shots": {
        "type": "array",
        "minItems": 1,
        "maxItems": 256,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "range_s",
            "motion",
            "hold_s",
            "camera",
            "palette",
            "seam_out"
          ],
          "properties": {
            "id": {
              "$ref": "common.schema.json#/$defs/SceneId"
            },
            "range_s": {
              "type": "array",
              "minItems": 2,
              "maxItems": 2,
              "items": {
                "$ref": "common.schema.json#/$defs/Seconds"
              }
            },
            "motion": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "mean",
                "peak",
                "moving_ratio"
              ],
              "properties": {
                "mean": {
                  "$ref": "common.schema.json#/$defs/Unit"
                },
                "peak": {
                  "$ref": "common.schema.json#/$defs/Unit"
                },
                "moving_ratio": {
                  "$ref": "common.schema.json#/$defs/Unit"
                }
              }
            },
            "hold_s": {
              "$ref": "common.schema.json#/$defs/Seconds"
            },
            "camera": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "pan_per_s",
                "tilt_per_s",
                "zoom_per_s",
                "confidence"
              ],
              "properties": {
                "kind": {
                  "$ref": "common.schema.json#/$defs/CameraKind"
                },
                "pan_per_s": {
                  "type": "number",
                  "minimum": -10,
                  "maximum": 10
                },
                "tilt_per_s": {
                  "type": "number",
                  "minimum": -10,
                  "maximum": 10
                },
                "zoom_per_s": {
                  "type": "number",
                  "minimum": -10,
                  "maximum": 10
                },
                "confidence": {
                  "$ref": "common.schema.json#/$defs/Unit"
                }
              }
            },
            "palette": {
              "type": "array",
              "minItems": 1,
              "maxItems": 5,
              "items": {
                "$ref": "common.schema.json#/$defs/HexColor"
              }
            },
            "seam_out": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "type",
                    "at_s",
                    "motion_before",
                    "motion_after",
                    "sharpness_ratio",
                    "blur_px_estimate"
                  ],
                  "properties": {
                    "type": {
                      "$ref": "common.schema.json#/$defs/SeamType"
                    },
                    "at_s": {
                      "$ref": "common.schema.json#/$defs/Seconds"
                    },
                    "motion_before": {
                      "$ref": "common.schema.json#/$defs/Unit"
                    },
                    "motion_after": {
                      "$ref": "common.schema.json#/$defs/Unit"
                    },
                    "sharpness_ratio": {
                      "$ref": "common.schema.json#/$defs/Unit"
                    },
                    "blur_px_estimate": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 40
                    },
                    "duration_s": {
                      "$ref": "common.schema.json#/$defs/Seconds"
                    }
                  }
                }
              ]
            }
          }
        }
      },
      "global": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "palette",
          "energy_curve",
          "energy_bin_s",
          "motion_ratio",
          "holds_s",
          "cuts",
          "camera_grammar"
        ],
        "properties": {
          "palette": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": {
              "$ref": "common.schema.json#/$defs/HexColor"
            }
          },
          "energy_curve": {
            "type": "array",
            "minItems": 1,
            "maxItems": 64,
            "items": {
              "$ref": "common.schema.json#/$defs/Unit"
            }
          },
          "energy_bin_s": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 100
          },
          "motion_ratio": {
            "$ref": "common.schema.json#/$defs/Unit"
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
                "$ref": "common.schema.json#/$defs/Seconds"
              },
              "max": {
                "$ref": "common.schema.json#/$defs/Seconds"
              }
            }
          },
          "cuts": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "hard",
              "velocity_matched",
              "whip",
              "dissolve"
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
              },
              "dissolve": {
                "type": "integer",
                "minimum": 0
              }
            }
          },
          "camera_grammar": {
            "type": "array",
            "maxItems": 7,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/CameraKind"
            }
          }
        }
      },
      "audio": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "silent",
              "duration_s",
              "rms_db",
              "music_bpm",
              "bpm_confidence",
              "speech",
              "events"
            ],
            "properties": {
              "silent": {
                "type": "boolean"
              },
              "duration_s": {
                "$ref": "common.schema.json#/$defs/Seconds"
              },
              "rms_db": {
                "type": "number",
                "minimum": -120,
                "maximum": 0
              },
              "music_bpm": {
                "oneOf": [
                  {
                    "type": "null"
                  },
                  {
                    "type": "number",
                    "minimum": 60,
                    "maximum": 200
                  }
                ]
              },
              "bpm_confidence": {
                "$ref": "common.schema.json#/$defs/Unit"
              },
              "speech": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "has_speech",
                  "speech_ratio",
                  "modulation",
                  "segments"
                ],
                "properties": {
                  "has_speech": {
                    "type": "boolean"
                  },
                  "speech_ratio": {
                    "$ref": "common.schema.json#/$defs/Unit"
                  },
                  "modulation": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 100
                  },
                  "segments": {
                    "type": "array",
                    "maxItems": 64,
                    "items": {
                      "type": "array",
                      "minItems": 2,
                      "maxItems": 2,
                      "items": {
                        "$ref": "common.schema.json#/$defs/Seconds"
                      }
                    }
                  }
                }
              },
              "events": {
                "type": "array",
                "maxItems": 32,
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "t",
                    "kind",
                    "strength",
                    "duration_ms"
                  ],
                  "properties": {
                    "t": {
                      "$ref": "common.schema.json#/$defs/Seconds"
                    },
                    "kind": {
                      "$ref": "common.schema.json#/$defs/SfxShape"
                    },
                    "strength": {
                      "$ref": "common.schema.json#/$defs/Unit"
                    },
                    "duration_ms": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 2000
                    }
                  }
                }
              },
              "peak": {
                "$ref": "common.schema.json#/$defs/Unit"
              }
            }
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

export const DOCUMENT_TYPES = ["reference-clone-plan", "reference-clone-request", "reference-comparison", "reference-facts"] as const;
export type DocumentType = "reference-clone-plan" | "reference-clone-request" | "reference-comparison" | "reference-facts";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "reference-clone-plan": [
    "reference_clone_plan_v1"
  ],
  "reference-clone-request": [
    "reference_clone_request_v1"
  ],
  "reference-comparison": [
    "reference_comparison_v1"
  ],
  "reference-facts": [
    "reference_facts_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type ReferenceClonePlan = {
    readonly "schema_version": "reference_clone_plan_v1";
    readonly "mode": "exact" | "style" | "inspiration";
    readonly "analysis": {
    readonly "facts_sha256": string;
    readonly "analysis_sha256": string;
  };
    readonly "target": {
    readonly "ratio": unknown;
    readonly "fps": number;
  };
    readonly "scenes": readonly ({
    readonly "scene_id": string;
    readonly "range_s": readonly (number)[];
    readonly "duration_frames": number;
    readonly "treatment": "reproduce" | "adapt" | "compose" | "redesign";
    readonly "blueprint": (null) | (unknown);
    readonly "confidence": number;
    readonly "seam_out": {
    readonly "source": (null) | ("hard" | "velocity_matched" | "whip" | "dissolve");
    readonly "target": (null) | ("zoom_through" | "reverse_zoom_through" | "direction_matched_cut" | "word_wave_cut" | "blur_crossfade" | "push_slide" | "hard_cut" | "none");
  };
    readonly "camera": {
    readonly "source": "static" | "push_in" | "pull_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "mixed";
    readonly "action": "keep" | "drop";
  };
    readonly "pinned_by_user": boolean;
  })[];
    readonly "brand": readonly ({
    readonly "entity": "logo" | "brand_name" | "product_name" | "color" | "typography" | "product_screens";
    readonly "source": "brand_kit" | "user_asset" | "neutral_default" | "adapt_to_product" | "reference";
    readonly "scene_id": (null) | (string);
  })[];
    readonly "audio": {
    readonly "music": (null) | ({
    readonly "source": "stock_search" | "stock_create";
    readonly "bpm": (null) | (number);
    readonly "energy": "low" | "medium" | "high";
    readonly "copy_reference": false;
  });
    readonly "sfx": readonly ({
    readonly "t": number;
    readonly "shape": "transient" | "swell";
    readonly "kind_candidates": readonly ("whoosh" | "click" | "typing" | "pop" | "hit" | "riser" | "ui-notify" | "transition")[];
  })[];
    readonly "voiceover_in_reference": boolean;
  };
    readonly "missing_capabilities": readonly ({
    readonly "code": string;
    readonly "scene_id": (null) | (string);
    readonly "action": "l1_line" | "nearest_blueprint";
  })[];
    readonly "gaps": readonly ("typography_not_measured" | "text_not_measured" | "elements_not_measured" | "logo_not_detected" | "analysis_truncated")[];
    readonly "iteration": {
    readonly "max_rounds": number;
    readonly "targets": readonly ({
    readonly "metric": "scene_duration" | "hold_median" | "palette" | "motion_ratio" | "tempo";
    readonly "scene_id": (null) | (string);
    readonly "absolute": number;
    readonly "unit": "s" | "delta_e" | "ratio" | "bpm";
  })[];
  };
  };
export type ReferenceCloneRequest = {
    readonly "schema_version": "reference_clone_request_v1";
    readonly "mode": "exact" | "style" | "inspiration";
    readonly "style_source_declared": true;
    readonly "brand": {
    readonly "kit_available": boolean;
    readonly "logo_available": boolean;
    readonly "product_assets_available": boolean;
  };
    readonly "target": {
    readonly "ratio": unknown;
    readonly "fps": number;
  };
    readonly "part_overrides": readonly ({
    readonly "scene_id": (null) | (string);
    readonly "aspect": "structure" | "blueprint" | "palette" | "typography" | "camera" | "seam" | "text" | "media" | "audio";
    readonly "action": "different" | "brand" | "keep";
  })[];
    readonly "iteration": {
    readonly "max_rounds": number;
  };
  };
export type ReferenceComparison = {
    readonly "schema_version": "reference_comparison_v1";
    readonly "round": number;
    readonly "reference": {
    readonly "facts_sha256": string;
  };
    readonly "candidate": {
    readonly "facts_sha256": string;
  };
    readonly "tolerances": {
    readonly "cut_frames": number;
    readonly "hold_s": number;
    readonly "palette_delta_e": number;
    readonly "motion_curve_rmse": number;
    readonly "bpm": number;
  };
    readonly "scenes": readonly ({
    readonly "scene_id": string;
    readonly "reference_range_s": readonly (number)[];
    readonly "candidate_range_s": (null) | (readonly (number)[]);
    readonly "cut_delta_frames": (null) | (number);
    readonly "duration_delta_s": (null) | (number);
    readonly "within": boolean;
  })[];
    readonly "counts": {
    readonly "reference_scenes": number;
    readonly "candidate_scenes": number;
  };
    readonly "holds": {
    readonly "reference_median_s": number;
    readonly "candidate_median_s": number;
    readonly "delta_s": number;
    readonly "within": boolean;
  };
    readonly "palette": {
    readonly "delta_e_mean": number;
    readonly "within": boolean;
  };
    readonly "motion": {
    readonly "curve_rmse": number;
    readonly "motion_ratio_delta": number;
    readonly "within": boolean;
  };
    readonly "tempo": (null) | ({
    readonly "reference_bpm": number;
    readonly "candidate_bpm": (null) | (number);
    readonly "delta_bpm": (null) | (number);
    readonly "within": boolean;
  });
    readonly "converged": boolean;
    readonly "remaining": readonly ({
    readonly "metric": "scene_duration" | "cut_time" | "scene_count" | "hold_median" | "palette" | "motion_curve" | "tempo";
    readonly "scene_id": (null) | (string);
    readonly "delta": number;
    readonly "absolute_target": number;
  })[];
  };
export type ReferenceFacts = {
    readonly "schema_version": "reference_facts_v1";
    readonly "source": {
    readonly "asset": unknown;
    readonly "duration_s": number;
    readonly "width": number;
    readonly "height": number;
    readonly "fps": number;
    readonly "has_audio": boolean;
  };
    readonly "analysis": {
    readonly "revision": string;
    readonly "rules_revision": number;
    readonly "sample_fps": number;
    readonly "frames_analyzed": number;
    readonly "analyzed_seconds": number;
    readonly "truncated": boolean;
    readonly "steps": readonly ({
    readonly "step": "probe" | "shots" | "motion" | "camera" | "palette" | "audio" | "typography" | "elements";
    readonly "status": "measured" | "skipped";
    readonly "reason"?: "model_step_not_run" | "no_audio_stream";
  })[];
  };
    readonly "shots": readonly ({
    readonly "id": string;
    readonly "range_s": readonly (number)[];
    readonly "motion": {
    readonly "mean": number;
    readonly "peak": number;
    readonly "moving_ratio": number;
  };
    readonly "hold_s": number;
    readonly "camera": {
    readonly "kind": "static" | "push_in" | "pull_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "mixed";
    readonly "pan_per_s": number;
    readonly "tilt_per_s": number;
    readonly "zoom_per_s": number;
    readonly "confidence": number;
  };
    readonly "palette": readonly (string)[];
    readonly "seam_out": (null) | ({
    readonly "type": "hard" | "velocity_matched" | "whip" | "dissolve";
    readonly "at_s": number;
    readonly "motion_before": number;
    readonly "motion_after": number;
    readonly "sharpness_ratio": number;
    readonly "blur_px_estimate": number;
    readonly "duration_s"?: number;
  });
  })[];
    readonly "global": {
    readonly "palette": readonly (string)[];
    readonly "energy_curve": readonly (number)[];
    readonly "energy_bin_s": number;
    readonly "motion_ratio": number;
    readonly "holds_s": {
    readonly "median": number;
    readonly "max": number;
  };
    readonly "cuts": {
    readonly "hard": number;
    readonly "velocity_matched": number;
    readonly "whip": number;
    readonly "dissolve": number;
  };
    readonly "camera_grammar": readonly ("static" | "push_in" | "pull_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "mixed")[];
  };
    readonly "audio": (null) | ({
    readonly "silent": boolean;
    readonly "duration_s": number;
    readonly "rms_db": number;
    readonly "music_bpm": (null) | (number);
    readonly "bpm_confidence": number;
    readonly "speech": {
    readonly "has_speech": boolean;
    readonly "speech_ratio": number;
    readonly "modulation": number;
    readonly "segments": readonly (readonly (number)[])[];
  };
    readonly "events": readonly ({
    readonly "t": number;
    readonly "kind": "transient" | "swell";
    readonly "strength": number;
    readonly "duration_ms": number;
  })[];
    readonly "peak"?: number;
  });
  };

export const reader = new ContractPackageReader({
  package: "reference-analysis",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
