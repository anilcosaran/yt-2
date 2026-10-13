// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/brand-template/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "brand-template-manifest.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/brand-template/v1/brand-template-manifest.schema.json",
    "title": "brand_template_manifest_v2",
    "description": "P06-03 Video Template model: the exact, immutable manifest of one Brand Template revision (a production format, KARAR-BRAND-ELEMENTS-TEMPLATE-VE-MOTION \u00a71/\u00a74, KARAR-ANLATIM-YERLESIM-KONUSMACI-VE-SABLONLAR \u00a79). Sections are required/optional/conditional/repeatable and list stable local scene blueprint ids (the Default Sequence); the Scene Library lists the blueprints Add Scene may copy; slots are typed with cardinality/default and fit/duration/overflow policies; locks and extension_policy are copied into every Composition template instance. Conditions are deterministic typed expressions (never code or an LLM prompt). No nested Video Template: Element/Motion/Kit/font/asset refs are dependencies. Narration bindings are reserved here and made concrete by P06-27. Brand owns the manifest; Composition compiles it into a project instance (template_compile@2). Semantic rules JSON Schema cannot express are in template-rules.json.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "template_id",
      "revision_id",
      "revision_number",
      "name",
      "description",
      "template_type",
      "supported_aspect_ratios",
      "compiler_profile",
      "extension_policy",
      "pinned",
      "dependencies",
      "options",
      "slots",
      "scene_blueprints",
      "sections",
      "scene_library",
      "locks"
    ],
    "properties": {
      "schema_version": {
        "const": "brand_template_manifest_v2"
      },
      "template_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "revision_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "revision_number": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
      },
      "name": {
        "description": "Visible name; never an identity (a rename keeps template_id, slot ids and every instance).",
        "$ref": "#/$defs/Label"
      },
      "description": {
        "type": "string",
        "maxLength": 500
      },
      "template_type": {
        "description": "P06-56/Q48 production format (motion-spark v1 canonical-enums.json template_types).",
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
      "supported_aspect_ratios": {
        "type": "array",
        "minItems": 1,
        "maxItems": 3,
        "uniqueItems": true,
        "items": {
          "$ref": "#/$defs/AspectRatio"
        }
      },
      "compiler_profile": {
        "const": "template_compile@2"
      },
      "extension_policy": {
        "description": "Add Scene behaviour of a template-bound instance (P06-03). approved_scene_only: only scene_library blueprints; current_template_only: any blueprint of this revision; locked_sequence: no scene is added, removed or reordered; freeform: any scene. Editor, Chat and headless commands apply the same policy.",
        "$ref": "#/$defs/ExtensionPolicy"
      },
      "pinned": {
        "description": "Pinned look (Q13): a later Kit/font/asset change never changes this revision.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kit",
          "fonts",
          "assets"
        ],
        "properties": {
          "kit": {
            "oneOf": [
              {
                "$ref": "#/$defs/KitRef"
              },
              {
                "type": "null"
              }
            ]
          },
          "fonts": {
            "type": "array",
            "maxItems": 16,
            "items": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/common.schema.json#/$defs/FontRef"
            }
          },
          "assets": {
            "type": "array",
            "maxItems": 32,
            "items": {
              "$ref": "#/$defs/StorageAssetPin"
            }
          }
        }
      },
      "dependencies": {
        "description": "Element/Motion/Kit/font/storage asset dependencies. A Video Template is never a dependency (no nested template in the first version; TK-30).",
        "type": "array",
        "maxItems": 64,
        "items": {
          "$ref": "#/$defs/Dependency"
        }
      },
      "options": {
        "description": "Typed boolean template options a condition may read (e.g. `show_cta`).",
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/Option"
        }
      },
      "slots": {
        "type": "array",
        "maxItems": 64,
        "items": {
          "$ref": "#/$defs/Slot"
        }
      },
      "scene_blueprints": {
        "type": "array",
        "minItems": 1,
        "maxItems": 32,
        "items": {
          "$ref": "#/$defs/SceneBlueprint"
        }
      },
      "sections": {
        "description": "Ordered Default Sequence: each section lists the blueprints it lays out, in order.",
        "type": "array",
        "minItems": 1,
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/Section"
        }
      },
      "scene_library": {
        "description": "Selectable Scene Library (separate from the Default Sequence): blueprints an approved_scene_only instance may add.",
        "type": "array",
        "maxItems": 32,
        "uniqueItems": true,
        "items": {
          "$ref": "#/$defs/LocalId"
        }
      },
      "locks": {
        "type": "array",
        "maxItems": 64,
        "items": {
          "$ref": "#/$defs/Lock"
        }
      },
      "narration": {
        "description": "Narration bindings (P06-27 NarrationSlotSpec): a scene's spoken track is generated speech of a text slot with the exact Voice route of a voice slot, or supplied audio of an audio slot. template_compile@2 records them on the instance; supplied audio is laid out with the P06-27 narration timing, generated speech stays pending until its TTS result (render-ready != final-ready).",
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/NarrationBinding"
        }
      },
      "overlay_rules": {
        "description": "P06-55 (additive optional): the template's opt-in layer rules (speaker card, CTA, section title, badge) as an overlay_rules_v1 document (overlay-rules v1, owner Composition). Brand validates it with the contract reader and never interprets it; Composition's overlay rule engine reads the pinned revision's rules. A layer the document does not define is never added (Q106); the user's request of a job patches it and the channel preference is the fallback.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/overlay-rules/v1/overlay-rules.schema.json"
      }
    },
    "$defs": {
      "LocalId": {
        "description": "Stable template-local id (slot, blueprint, section, layer, lock, option). Never a visible label.",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z0-9_]+)*$",
        "maxLength": 64
      },
      "Label": {
        "type": "string",
        "minLength": 1,
        "maxLength": 80
      },
      "AspectRatio": {
        "enum": [
          "16:9",
          "9:16",
          "1:1"
        ]
      },
      "ExtensionPolicy": {
        "enum": [
          "freeform",
          "approved_scene_only",
          "current_template_only",
          "locked_sequence"
        ]
      },
      "KitRef": {
        "allOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
          },
          {
            "properties": {
              "brand_asset_kind": {
                "const": "kit"
              }
            }
          }
        ]
      },
      "StorageAssetPin": {
        "description": "A template-owned Storage asset (demo/default media): ready object, exact checksum. Never a project's customer source media unless the author explicitly retained it (P06-05 publish gate).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "storage_object_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "checksum_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "Dependency": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "dependency_id",
          "kind",
          "ref"
        ],
        "properties": {
          "dependency_id": {
            "$ref": "#/$defs/LocalId"
          },
          "kind": {
            "enum": [
              "brand_element",
              "motion",
              "brand_kit",
              "font",
              "storage_asset"
            ]
          },
          "ref": {
            "type": "object"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "enum": [
                    "brand_element",
                    "motion",
                    "brand_kit"
                  ]
                }
              }
            },
            "then": {
              "properties": {
                "ref": {
                  "allOf": [
                    {
                      "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
                    },
                    {
                      "not": {
                        "properties": {
                          "brand_asset_kind": {
                            "const": "template"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "font"
                }
              }
            },
            "then": {
              "properties": {
                "ref": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/common.schema.json#/$defs/FontRef"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "storage_asset"
                }
              }
            },
            "then": {
              "properties": {
                "ref": {
                  "$ref": "#/$defs/StorageAssetPin"
                }
              }
            }
          }
        ]
      },
      "Option": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "option_id",
          "label",
          "default"
        ],
        "properties": {
          "option_id": {
            "$ref": "#/$defs/LocalId"
          },
          "label": {
            "$ref": "#/$defs/Label"
          },
          "default": {
            "type": "boolean"
          }
        }
      },
      "Cardinality": {
        "description": "How many bindings the slot takes per section repeat. A required slot has min >= 1 (template-rules.json).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "min",
          "max"
        ],
        "properties": {
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
      "Anchor": {
        "enum": [
          "top_left",
          "top",
          "top_right",
          "left",
          "center",
          "right",
          "bottom_left",
          "bottom",
          "bottom_right"
        ]
      },
      "Placement": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "anchor",
          "margin_pct",
          "scale"
        ],
        "properties": {
          "anchor": {
            "$ref": "#/$defs/Anchor"
          },
          "margin_pct": {
            "type": "number",
            "minimum": 0,
            "maximum": 20
          },
          "scale": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 1
          }
        }
      },
      "TextStyle": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "font",
          "size_ratio_of_min_side",
          "color",
          "align"
        ],
        "properties": {
          "font": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/common.schema.json#/$defs/FontRef"
          },
          "size_ratio_of_min_side": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 0.5
          },
          "color": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$"
          },
          "align": {
            "enum": [
              "start",
              "center",
              "end"
            ]
          }
        }
      },
      "SlotDefault": {
        "description": "Typed default: a placeholder (nothing is rendered; a required slot stays unbound), a literal text, or a template-owned Storage asset pinned in `pinned.assets`.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind"
            ],
            "properties": {
              "kind": {
                "const": "placeholder"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "text"
            ],
            "properties": {
              "kind": {
                "const": "text"
              },
              "text": {
                "type": "string",
                "minLength": 1,
                "maxLength": 2000
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "asset"
            ],
            "properties": {
              "kind": {
                "const": "storage_asset"
              },
              "asset": {
                "$ref": "#/$defs/StorageAssetPin"
              }
            }
          }
        ]
      },
      "SlotCommon": {
        "type": "object",
        "required": [
          "slot_id",
          "kind",
          "label",
          "scene_blueprint_id",
          "required",
          "cardinality"
        ],
        "properties": {
          "slot_id": {
            "$ref": "#/$defs/LocalId"
          },
          "label": {
            "$ref": "#/$defs/Label"
          },
          "scene_blueprint_id": {
            "description": "The blueprint whose layers use the slot; null for a project-level slot (captions, voice).",
            "oneOf": [
              {
                "$ref": "#/$defs/LocalId"
              },
              {
                "type": "null"
              }
            ]
          },
          "required": {
            "type": "boolean"
          },
          "cardinality": {
            "$ref": "#/$defs/Cardinality"
          },
          "default": {
            "$ref": "#/$defs/SlotDefault"
          },
          "role": {
            "$ref": "#/$defs/SlotRole"
          }
        }
      },
      "Slot": {
        "oneOf": [
          {
            "$ref": "#/$defs/VideoSlot"
          },
          {
            "$ref": "#/$defs/ImageSlot"
          },
          {
            "$ref": "#/$defs/TextSlot"
          },
          {
            "$ref": "#/$defs/CaptionSlot"
          },
          {
            "$ref": "#/$defs/AudioSlot"
          },
          {
            "$ref": "#/$defs/VoiceSlot"
          }
        ]
      },
      "VideoSlot": {
        "type": "object",
        "additionalProperties": false,
        "allOf": [
          {
            "$ref": "#/$defs/SlotCommon"
          }
        ],
        "required": [
          "fit",
          "duration",
          "audio",
          "media_fit"
        ],
        "properties": {
          "slot_id": true,
          "label": true,
          "scene_blueprint_id": true,
          "required": true,
          "cardinality": true,
          "default": true,
          "kind": {
            "const": "video"
          },
          "fit": {
            "enum": [
              "contain",
              "cover"
            ]
          },
          "duration": {
            "description": "Bounds of the bound source range (seconds); outside them the declared media_fit applies, never a silent cut.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "min_seconds",
              "max_seconds"
            ],
            "properties": {
              "min_seconds": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 3600
              },
              "max_seconds": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 3600
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
          "media_fit": {
            "$ref": "#/$defs/MediaFit"
          },
          "role": true
        }
      },
      "ImageSlot": {
        "type": "object",
        "additionalProperties": false,
        "allOf": [
          {
            "$ref": "#/$defs/SlotCommon"
          }
        ],
        "required": [
          "fit",
          "placement",
          "media_fit"
        ],
        "properties": {
          "slot_id": true,
          "label": true,
          "scene_blueprint_id": true,
          "required": true,
          "cardinality": true,
          "default": true,
          "kind": {
            "const": "image"
          },
          "fit": {
            "enum": [
              "contain",
              "cover"
            ]
          },
          "placement": {
            "$ref": "#/$defs/Placement"
          },
          "media_fit": {
            "description": "Declared fit of an image slot (an image has no time: trim and hold both end with the scene; reject refuses a scene the image would not cover).",
            "enum": [
              "trim",
              "hold",
              "reject"
            ]
          },
          "role": true
        }
      },
      "TextSlot": {
        "type": "object",
        "additionalProperties": false,
        "allOf": [
          {
            "$ref": "#/$defs/SlotCommon"
          }
        ],
        "required": [
          "max_length",
          "overflow",
          "style",
          "hold_seconds",
          "brand_bound"
        ],
        "properties": {
          "slot_id": true,
          "label": true,
          "scene_blueprint_id": true,
          "required": true,
          "cardinality": true,
          "default": true,
          "kind": {
            "const": "text"
          },
          "max_length": {
            "type": "integer",
            "minimum": 1,
            "maximum": 2000
          },
          "overflow": {
            "description": "Longer text than max_length is always rejected; wrap/shrink_then_wrap is the layout policy inside the box.",
            "enum": [
              "wrap",
              "shrink_then_wrap",
              "reject"
            ]
          },
          "style": {
            "$ref": "#/$defs/TextStyle"
          },
          "hold_seconds": {
            "description": "Shown from the scene start for this long (clamped to the scene); null = the whole scene.",
            "oneOf": [
              {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 3600
              },
              {
                "type": "null"
              }
            ]
          },
          "brand_bound": {
            "description": "Fields an explicit Kit apply may change (P06-28); compile keeps the pinned look (Q13).",
            "type": "array",
            "uniqueItems": true,
            "items": {
              "enum": [
                "color",
                "font"
              ]
            }
          },
          "role": true
        }
      },
      "CaptionSlot": {
        "type": "object",
        "additionalProperties": false,
        "allOf": [
          {
            "$ref": "#/$defs/SlotCommon"
          }
        ],
        "required": [
          "source_kind",
          "style"
        ],
        "properties": {
          "slot_id": true,
          "label": true,
          "scene_blueprint_id": true,
          "required": true,
          "cardinality": true,
          "default": true,
          "kind": {
            "const": "caption"
          },
          "source_kind": {
            "const": "transcript"
          },
          "style": {
            "const": "pinned_kit"
          },
          "role": true
        }
      },
      "AudioSlot": {
        "description": "Supplied audio: an attached audio source (P06-27 narration `supplied_audio`; P06-63 music).",
        "type": "object",
        "additionalProperties": false,
        "allOf": [
          {
            "$ref": "#/$defs/SlotCommon"
          }
        ],
        "required": [
          "use"
        ],
        "properties": {
          "slot_id": true,
          "label": true,
          "scene_blueprint_id": true,
          "required": true,
          "cardinality": true,
          "default": true,
          "kind": {
            "const": "audio"
          },
          "use": {
            "enum": [
              "narration",
              "music"
            ]
          },
          "role": true
        }
      },
      "VoiceSlot": {
        "description": "Exact Voice route filled by the user (P06-27 NarrationVoiceRoute: voice resource + speech_generate@1 model + language); a private voice identity is never part of a published template.",
        "type": "object",
        "additionalProperties": false,
        "allOf": [
          {
            "$ref": "#/$defs/SlotCommon"
          }
        ],
        "properties": {
          "slot_id": true,
          "label": true,
          "scene_blueprint_id": true,
          "required": true,
          "cardinality": true,
          "default": true,
          "kind": {
            "const": "voice"
          },
          "role": true
        }
      },
      "SceneTiming": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "policy",
          "preview_seconds",
          "min_seconds",
          "max_seconds"
        ],
        "properties": {
          "policy": {
            "enum": [
              "fixed",
              "follow_media",
              "follow_narration"
            ]
          },
          "fixed_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 3600
          },
          "follow_slot_id": {
            "$ref": "#/$defs/LocalId"
          },
          "preview_seconds": {
            "description": "Length while the followed media/narration is not bound yet (test preview only; never final-ready).",
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 3600
          },
          "min_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 3600
          },
          "max_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 3600
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "policy": {
                  "const": "fixed"
                }
              }
            },
            "then": {
              "required": [
                "fixed_seconds"
              ],
              "not": {
                "required": [
                  "follow_slot_id"
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "policy": {
                  "const": "follow_media"
                }
              }
            },
            "then": {
              "required": [
                "follow_slot_id"
              ],
              "not": {
                "required": [
                  "fixed_seconds"
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "policy": {
                  "const": "follow_narration"
                }
              }
            },
            "then": {
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "fixed_seconds"
                    ]
                  },
                  {
                    "required": [
                      "follow_slot_id"
                    ]
                  }
                ]
              }
            }
          }
        ]
      },
      "BlueprintLayer": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "layer_local_id",
          "source"
        ],
        "properties": {
          "layer_local_id": {
            "$ref": "#/$defs/LocalId"
          },
          "source": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "slot_id"
                ],
                "properties": {
                  "kind": {
                    "const": "slot"
                  },
                  "slot_id": {
                    "$ref": "#/$defs/LocalId"
                  }
                }
              },
              {
                "description": "Literal template text (structure the instance user does not fill).",
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "text",
                  "style"
                ],
                "properties": {
                  "kind": {
                    "const": "fixed_text"
                  },
                  "text": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 500
                  },
                  "style": {
                    "$ref": "#/$defs/TextStyle"
                  }
                }
              }
            ]
          }
        }
      },
      "SceneBlueprint": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "blueprint_local_id",
          "label",
          "timing",
          "layers"
        ],
        "properties": {
          "blueprint_local_id": {
            "$ref": "#/$defs/LocalId"
          },
          "label": {
            "$ref": "#/$defs/Label"
          },
          "timing": {
            "$ref": "#/$defs/SceneTiming"
          },
          "layers": {
            "description": "Bottom-first z-order of the blueprint's layers.",
            "type": "array",
            "minItems": 1,
            "maxItems": 60,
            "items": {
              "$ref": "#/$defs/BlueprintLayer"
            }
          }
        }
      },
      "Section": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "section_local_id",
          "label",
          "presence",
          "scene_blueprint_ids"
        ],
        "properties": {
          "section_local_id": {
            "$ref": "#/$defs/LocalId"
          },
          "label": {
            "$ref": "#/$defs/Label"
          },
          "presence": {
            "enum": [
              "required",
              "optional",
              "conditional",
              "repeatable"
            ]
          },
          "scene_blueprint_ids": {
            "type": "array",
            "minItems": 1,
            "maxItems": 8,
            "uniqueItems": true,
            "items": {
              "$ref": "#/$defs/LocalId"
            }
          },
          "default_enabled": {
            "type": "boolean"
          },
          "condition": {
            "$ref": "#/$defs/Condition"
          },
          "repeat": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "min",
              "max",
              "default"
            ],
            "properties": {
              "min": {
                "type": "integer",
                "minimum": 0,
                "maximum": 20
              },
              "max": {
                "type": "integer",
                "minimum": 1,
                "maximum": 20
              },
              "default": {
                "type": "integer",
                "minimum": 0,
                "maximum": 20
              },
              "driver_slot_id": {
                "description": "The repeat count follows how many bindings this slot got (one repeat per bound media), within [min, max]; more is an explicit error.",
                "$ref": "#/$defs/LocalId"
              }
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "presence": {
                  "const": "optional"
                }
              }
            },
            "then": {
              "required": [
                "default_enabled"
              ],
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "condition"
                    ]
                  },
                  {
                    "required": [
                      "repeat"
                    ]
                  }
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "presence": {
                  "const": "conditional"
                }
              }
            },
            "then": {
              "required": [
                "condition"
              ],
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "default_enabled"
                    ]
                  },
                  {
                    "required": [
                      "repeat"
                    ]
                  }
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "presence": {
                  "const": "repeatable"
                }
              }
            },
            "then": {
              "required": [
                "repeat"
              ],
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "default_enabled"
                    ]
                  },
                  {
                    "required": [
                      "condition"
                    ]
                  }
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "presence": {
                  "const": "required"
                }
              }
            },
            "then": {
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "default_enabled"
                    ]
                  },
                  {
                    "required": [
                      "condition"
                    ]
                  },
                  {
                    "required": [
                      "repeat"
                    ]
                  }
                ]
              }
            }
          }
        ]
      },
      "Condition": {
        "description": "Deterministic typed expression over bindings, options and the project format. Depth <= 4 and <= 32 nodes (template-rules.json). No code, no string expression, no model call.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "op",
              "slot_id"
            ],
            "properties": {
              "op": {
                "const": "slot_bound"
              },
              "slot_id": {
                "$ref": "#/$defs/LocalId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "op",
              "slot_id",
              "count"
            ],
            "properties": {
              "op": {
                "const": "slot_count_at_least"
              },
              "slot_id": {
                "$ref": "#/$defs/LocalId"
              },
              "count": {
                "type": "integer",
                "minimum": 1,
                "maximum": 20
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "op",
              "option_id"
            ],
            "properties": {
              "op": {
                "const": "option_enabled"
              },
              "option_id": {
                "$ref": "#/$defs/LocalId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "op",
              "values"
            ],
            "properties": {
              "op": {
                "const": "aspect_ratio_in"
              },
              "values": {
                "type": "array",
                "minItems": 1,
                "maxItems": 3,
                "uniqueItems": true,
                "items": {
                  "$ref": "#/$defs/AspectRatio"
                }
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "op",
              "conditions"
            ],
            "properties": {
              "op": {
                "enum": [
                  "all",
                  "any"
                ]
              },
              "conditions": {
                "type": "array",
                "minItems": 1,
                "maxItems": 8,
                "items": {
                  "$ref": "#/$defs/Condition"
                }
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "op",
              "condition"
            ],
            "properties": {
              "op": {
                "const": "not"
              },
              "condition": {
                "$ref": "#/$defs/Condition"
              }
            }
          }
        ]
      },
      "LockProperty": {
        "description": "structure: add/remove/reorder/split layers or the scene; content: text/media body; style: text/shape/animation style; position: transform/arrange; timing: scene or layer timing.",
        "enum": [
          "structure",
          "content",
          "style",
          "position",
          "timing"
        ]
      },
      "Lock": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "lock_id",
          "target",
          "locked_properties"
        ],
        "properties": {
          "lock_id": {
            "$ref": "#/$defs/LocalId"
          },
          "target": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "blueprint_local_id"
                ],
                "properties": {
                  "kind": {
                    "const": "scene"
                  },
                  "blueprint_local_id": {
                    "$ref": "#/$defs/LocalId"
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "blueprint_local_id",
                  "layer_local_id"
                ],
                "properties": {
                  "kind": {
                    "const": "layer"
                  },
                  "blueprint_local_id": {
                    "$ref": "#/$defs/LocalId"
                  },
                  "layer_local_id": {
                    "$ref": "#/$defs/LocalId"
                  }
                }
              }
            ]
          },
          "locked_properties": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "uniqueItems": true,
            "items": {
              "$ref": "#/$defs/LockProperty"
            }
          }
        }
      },
      "NarrationBinding": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "narration_id",
          "scene_blueprint_id",
          "text_slot_id",
          "voice_slot_id",
          "source_mode",
          "audio_slot_id"
        ],
        "properties": {
          "narration_id": {
            "$ref": "#/$defs/LocalId"
          },
          "scene_blueprint_id": {
            "$ref": "#/$defs/LocalId"
          },
          "text_slot_id": {
            "$ref": "#/$defs/LocalId"
          },
          "voice_slot_id": {
            "oneOf": [
              {
                "$ref": "#/$defs/LocalId"
              },
              {
                "type": "null"
              }
            ]
          },
          "source_mode": {
            "enum": [
              "supplied_audio",
              "generated_speech"
            ]
          },
          "audio_slot_id": {
            "oneOf": [
              {
                "$ref": "#/$defs/LocalId"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "MediaFit": {
        "description": "Declared fit of a media slot when the bound media and the scene length differ (P06-27 NarrationMediaFitPolicy vocabulary, K165): trim = a longer video is trimmed at 1x; loop = a shorter video repeats whole copies of its window; hold = a shorter video holds its last frame (clip placement hold_last_frame_frames); reject = any mismatch is an explicit decision. Mandatory on every media slot; never a silent cut, speed-up or stretch.",
        "enum": [
          "trim",
          "hold",
          "loop",
          "reject"
        ]
      },
      "SlotRole": {
        "description": "P06-56 (additive optional): what a slot is FOR in its production format, so the engine places @mention media and text by role and cardinality instead of by order. Media roles: host (presenter/anchor video), main (the primary content), item (one per repeat of a repeatable section), reaction, background, frame (post/device frame), logo, b_roll. Text roles: title, subtitle, hook, headline, body, comment, attribution, cta. A role must match the slot kind (record invariant inv_slot_role_matches_kind); a slot without a role is placed by kind and order.",
        "enum": [
          "host",
          "main",
          "item",
          "reaction",
          "background",
          "frame",
          "logo",
          "b_roll",
          "title",
          "subtitle",
          "hook",
          "headline",
          "body",
          "comment",
          "attribution",
          "cta"
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
  "composition-project/v1/common.schema.json": {
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
  "overlay-rules/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/overlay-rules/v1/common.schema.json",
    "title": "overlay_rules_common_v1",
    "description": "Shared definitions of the P06-55 overlay rules package (KARAR-ANLATIM-YERLESIM-KONUSMACI-VE-SABLONLAR SS8, Q49, Q106, TK-27): the layer kinds a template or a channel preference may define, the named PresenterLayout regions they sit in, the visual reference, the origin of a rule and the drop vocabulary of the overlay plan. Not a standalone document type.",
    "$defs": {
      "LayerKind": {
        "description": "speaker_card: optional speaker introduction card; cta: subscribe/like card bound to the spoken word; section_title: title at a section boundary (at most 2.5 s); badge: persistent corner badge. A layer that no rule defines is never added (Q106).",
        "enum": [
          "speaker_card",
          "cta",
          "section_title",
          "badge"
        ]
      },
      "RegionName": {
        "description": "lower_third, cta and corner_badge are the PresenterLayout regions of P06-53 (aligned to the person's camera region in multi-camera layouts); camera_top is the strip above a camera region that the overlay engine derives as the alternate of the lower third.",
        "enum": [
          "lower_third",
          "cta",
          "corner_badge",
          "camera_top"
        ]
      },
      "RegionRef": {
        "description": "One placement region of one frame's layout: the named region, the camera it belongs to (multi-camera layouts) and whether it is mirrored to the opposite side of the canvas (the region-change step of the conflict order).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "name",
          "mirrored"
        ],
        "properties": {
          "name": {
            "$ref": "#/$defs/RegionName"
          },
          "camera_index": {
            "type": "integer",
            "minimum": 0,
            "maximum": 3
          },
          "mirrored": {
            "type": "boolean"
          }
        }
      },
      "RuleOrigin": {
        "description": "Where the effective rule of a layer came from. Precedence per layer: the user's request of this job, then the selected template's overlay_rules, then the channel preference. Layers are replaced as a whole, never merged field by field.",
        "enum": [
          "user_request",
          "template",
          "channel_preference"
        ]
      },
      "Decider": {
        "description": "rule: the deterministic engine (spoken CTA word, section start, persistent badge); model: the selected model proposed the interval and the engine validated it; user: the user named the time (a CTA at an exact second).",
        "enum": [
          "rule",
          "model",
          "user"
        ]
      },
      "SpeakerLabel": {
        "description": "Stable per-source speaker label S1, S2, ... (multi-speaker v1 SpeakerLabel).",
        "type": "string",
        "pattern": "^S[1-9][0-9]?$"
      },
      "IdentitySource": {
        "description": "Where a card's name came from. Only the user or a confirmed suggestion ever reaches a card; an unconfirmed transcript suggestion (\"ben X\") and an unknown name never do (nothing is invented).",
        "enum": [
          "user",
          "confirmed_suggestion"
        ]
      },
      "CtaPosition": {
        "description": "Fixed CTA positions (Q106 start / middle / end plus the template policy): start = the earliest allowed time, percent_25 = 25 % of the duration, middle = 50 %, before_outro = just before the outro section starts (the end when there is none), end = shortly before the end.",
        "enum": [
          "start",
          "percent_25",
          "middle",
          "before_outro",
          "end"
        ]
      },
      "WordId": {
        "description": "Word id of the exact transcript revision (P03-22/P06-08): w_<index>.",
        "type": "string",
        "pattern": "^w_(0|[1-9][0-9]{0,5})$"
      },
      "Frame": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100000000
      },
      "Seconds": {
        "type": "number",
        "minimum": 0,
        "maximum": 86400
      },
      "Label": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "VisualRef": {
        "description": "The visual part of a layer (KARAR SS8 \"Nerede tanimlanir\"): the platform's standard card that slides up from the bottom (the Q106 default) or an exact Brand Element/Motion revision (the P06-06 seeds are patterns of the same library). The rules never carry raw layer code.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind"
            ],
            "properties": {
              "kind": {
                "const": "standard_card"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "ref"
            ],
            "properties": {
              "kind": {
                "const": "brand_ref"
              },
              "ref": {
                "allOf": [
                  {
                    "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
                  },
                  {
                    "properties": {
                      "brand_asset_kind": {
                        "enum": [
                          "element",
                          "motion"
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        ]
      },
      "DropReason": {
        "description": "Why a proposed layer instance was not added. identity_unknown: Auto with no name (a note goes to Varsayimlarim); identity_pending: Ask asked for the name; frequency_cap: more than the per-person count; no_valid_window / insufficient_face_samples: no window passed the face-track validation (the card never shows unverified); negated_sentence / too_early / too_close / count_cap: the CTA rules; no_cta_position: no phrase and no position; conflict_lower_priority: lost the region-change, +-2 s shift order to a higher priority layer; outside_timeline: the proposal is outside the timeline; no_section_text: the section has no title.",
        "enum": [
          "identity_unknown",
          "identity_pending",
          "frequency_cap",
          "no_valid_window",
          "insufficient_face_samples",
          "negated_sentence",
          "too_early",
          "too_close",
          "count_cap",
          "no_cta_position",
          "conflict_lower_priority",
          "outside_timeline",
          "no_section_text"
        ]
      },
      "ShiftReason": {
        "description": "face_validation: the engine moved the window inside the model's interval until every frame passed; conflict: the +-2 s shift step of the priority conflict order.",
        "enum": [
          "face_validation",
          "conflict"
        ]
      }
    }
  },
  "overlay-rules/v1/overlay-rules.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/overlay-rules/v1/overlay-rules.schema.json",
    "title": "overlay_rules_v1",
    "description": "The overlay rule set of a template (brand_template_manifest_v2.overlay_rules, additive optional field) or of a channel preference (KARAR-ANLATIM-YERLESIM-KONUSMACI-VE-SABLONLAR SS8, Q49, Q106). Every layer is opt-in: a layer that is absent or enabled=false is never added; there are no defaults that switch a layer on (Q106). Values omitted from an enabled layer take the frozen defaults of overlay-rules.json (a start proposal, not a hard rule). The visual part is a Brand Element/Motion revision or the standard card; the rules never carry layer code. Per layer the effective rule is the user's request of this job, else the selected template's, else the channel preference.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version"
    ],
    "properties": {
      "schema_version": {
        "const": "overlay_rules_v1"
      },
      "speaker_card": {
        "$ref": "#/$defs/SpeakerCardRule"
      },
      "cta": {
        "$ref": "#/$defs/CtaRule"
      },
      "section_title": {
        "$ref": "#/$defs/SectionTitleRule"
      },
      "badge": {
        "$ref": "#/$defs/BadgeRule"
      }
    },
    "$defs": {
      "SpeakerCardRule": {
        "description": "Optional speaker introduction card. The agent asks for name and title; nothing is invented and in Auto a speaker whose name is unknown gets no card and a note in Varsayimlarim. Frequency per person by video length unless a fixed count is set; each display is short (reading time, 3-4 s by default) and closes; the window is validated frame by frame against the layout and the face tracks (TK-27).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "require_title": {
            "description": "When true a card also needs the title (job), not only the name.",
            "type": "boolean"
          },
          "frequency": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "mode"
                ],
                "properties": {
                  "mode": {
                    "const": "by_duration"
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "mode",
                  "per_person"
                ],
                "properties": {
                  "mode": {
                    "const": "fixed"
                  },
                  "per_person": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 6
                  }
                }
              }
            ]
          },
          "display_seconds": {
            "description": "Bounds of one display; the actual length follows the reading time of the card text inside them. min <= max is a record invariant.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "min",
              "max"
            ],
            "properties": {
              "min": {
                "type": "number",
                "minimum": 2,
                "maximum": 6
              },
              "max": {
                "type": "number",
                "minimum": 2,
                "maximum": 8
              }
            }
          },
          "visual": {
            "$ref": "common.schema.json#/$defs/VisualRef"
          }
        }
      },
      "CtaRule": {
        "description": "Subscribe / like card. It binds to the spoken CTA word (a negated sentence never triggers it), at most max_count times, at least min_gap_seconds apart and never before no_earlier_than_seconds. When no CTA word is spoken at all, the fixed positions apply. Defined only by the user's request or a template/channel preference (Q106); the default look is the standard card that slides up from the bottom.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "phrase_binding": {
            "description": "Bind to spoken CTA words (default true). false: only the fixed positions.",
            "type": "boolean"
          },
          "phrases": {
            "description": "Extra spoken triggers on top of the platform dictionary (case and diacritics folded; a trailing * matches a word stem).",
            "type": "array",
            "maxItems": 12,
            "uniqueItems": true,
            "items": {
              "type": "string",
              "minLength": 2,
              "maxLength": 40
            }
          },
          "max_count": {
            "type": "integer",
            "minimum": 1,
            "maximum": 6
          },
          "min_gap_seconds": {
            "type": "number",
            "minimum": 30,
            "maximum": 3600
          },
          "no_earlier_than_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 300
          },
          "positions": {
            "description": "Fixed positions used when no CTA word is spoken (default percent_25 then before_outro), or always when phrase_binding is false.",
            "type": "array",
            "maxItems": 3,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/CtaPosition"
            }
          },
          "display_seconds": {
            "type": "number",
            "minimum": 2,
            "maximum": 8
          },
          "label": {
            "description": "Card text; when absent the renderer's localized default is used.",
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "visual": {
            "$ref": "common.schema.json#/$defs/VisualRef"
          }
        }
      },
      "SectionTitleRule": {
        "description": "Section title at each section boundary of the template instance, shown at most 2.5 s (the cap is part of the schema).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "max_seconds": {
            "type": "number",
            "minimum": 0.5,
            "maximum": 2.5
          },
          "visual": {
            "$ref": "common.schema.json#/$defs/VisualRef"
          }
        }
      },
      "BadgeRule": {
        "description": "Persistent corner badge (a Brand Element). It has the lowest priority: it hides where a higher layer, a face or the captions need the corner.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "visual": {
            "$ref": "common.schema.json#/$defs/VisualRef"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "enabled": {
                  "const": true
                }
              },
              "required": [
                "enabled"
              ]
            },
            "then": {
              "required": [
                "visual"
              ]
            }
          }
        ]
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["brand-template-manifest"] as const;
export type DocumentType = "brand-template-manifest";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "brand-template-manifest": [
    "brand_template_manifest_v2"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type BrandTemplateManifest = {
    readonly "schema_version": "brand_template_manifest_v2";
    readonly "template_id": unknown;
    readonly "revision_id": unknown;
    readonly "revision_number": unknown;
    readonly "name": string;
    readonly "description": string;
    readonly "template_type": "tanitim_motion_film" | "slayt_egitim" | "konsept_video" | "program_formati" | "ham_video_formati" | "sosyal_kanvas_dikey" | "yorum_tepki_derleme";
    readonly "supported_aspect_ratios": readonly ("16:9" | "9:16" | "1:1")[];
    readonly "compiler_profile": "template_compile@2";
    readonly "extension_policy": "freeform" | "approved_scene_only" | "current_template_only" | "locked_sequence";
    readonly "pinned": {
    readonly "kit": (unknown) | (null);
    readonly "fonts": readonly (unknown)[];
    readonly "assets": readonly (unknown)[];
  };
    readonly "dependencies": readonly (unknown)[];
    readonly "options": readonly (unknown)[];
    readonly "slots": readonly (unknown)[];
    readonly "scene_blueprints": readonly (unknown)[];
    readonly "sections": readonly (unknown)[];
    readonly "scene_library": readonly (string)[];
    readonly "locks": readonly (unknown)[];
    readonly "narration"?: readonly (unknown)[];
    readonly "overlay_rules"?: unknown;
  };

export const reader = new ContractPackageReader({
  package: "brand-template",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
