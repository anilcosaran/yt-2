'use client'

// In-memory state of the Memory page (yt-2 mock; resets on reload). "AI ile oluştur" and file/link reading are
// simulated with timers.

import { create } from 'zustand'

import {
  SEED_INGESTION,
  SEED_KNOWLEDGE,
  SEED_RULES,
  SEED_SKILLS,
  type IngestionSettings,
  type KnowledgeItem,
  type RuleItem,
  type SkillItem,
} from './memory-seed'

type MemoryState = {
  knowledge: KnowledgeItem[]
  rules: RuleItem[]
  skills: SkillItem[]
  ingestion: IngestionSettings

  saveKnowledge: (item: Omit<KnowledgeItem, 'id' | 'updatedAt' | 'status' | 'auto' | 'enabled'> & { id?: string }) => void
  saveRule: (item: Omit<RuleItem, 'id' | 'updatedAt' | 'enabled'> & { id?: string }) => void
  saveSkill: (item: Omit<SkillItem, 'id' | 'updatedAt' | 'origin' | 'enabled'> & { id?: string; enabled?: boolean }) => string
  setEnabled: (list: 'knowledge' | 'rules' | 'skills', id: string, enabled: boolean) => void
  remove: (list: 'knowledge' | 'rules' | 'skills', id: string) => void
  retryKnowledge: (id: string) => void
  updateSkill: (id: string) => void
  copySkill: (id: string) => string | null
  setIngestion: (patch: Partial<IngestionSettings>) => void
}

let sequence = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(sequence += 1)}`
const stamp = () => new Date().toISOString()

export const useMemoryStore = create<MemoryState>()((set, get) => {
  /** Files and links are "read" for a moment before they become knowledge. */
  const finishReading = (id: string) => {
    setTimeout(() => {
      set((state) => ({
        knowledge: state.knowledge.map((item) => (item.id === id
          ? { ...item, status: 'ready', body: item.body || `${item.source ?? item.title} içeriği okundu ve özetlendi.` }
          : item)),
      }))
    }, 2500)
  }

  return {
    knowledge: SEED_KNOWLEDGE,
    rules: SEED_RULES,
    skills: SEED_SKILLS,
    ingestion: SEED_INGESTION,

    saveKnowledge: (input) => {
      if (input.id) {
        set((state) => ({
          knowledge: state.knowledge.map((item) => (item.id === input.id ? { ...item, ...input, id: item.id, updatedAt: stamp() } : item)),
        }))
        return
      }
      const reading = input.kind === 'file' || input.kind === 'link'
      const item: KnowledgeItem = {
        ...input,
        id: nextId('k'),
        enabled: true,
        auto: false,
        status: reading ? 'processing' : 'ready',
        updatedAt: stamp(),
      }
      set((state) => ({ knowledge: [item, ...state.knowledge] }))
      if (reading) finishReading(item.id)
    },

    saveRule: (input) => {
      if (input.id) {
        set((state) => ({ rules: state.rules.map((rule) => (rule.id === input.id ? { ...rule, ...input, id: rule.id, updatedAt: stamp() } : rule)) }))
        return
      }
      set((state) => ({ rules: [{ ...input, id: nextId('r'), enabled: true, updatedAt: stamp() }, ...state.rules] }))
    },

    saveSkill: (input) => {
      if (input.id) {
        const id = input.id
        set((state) => ({ skills: state.skills.map((skill) => (skill.id === id ? { ...skill, ...input, id, updatedAt: stamp() } : skill)) }))
        return id
      }
      const id = nextId('s')
      set((state) => ({ skills: [{ ...input, id, origin: 'mine', enabled: input.enabled ?? true, updatedAt: stamp() }, ...state.skills] }))
      return id
    },

    setEnabled: (list, id, enabled) => set((state) => ({
      [list]: (state[list] as Array<{ id: string; enabled: boolean; draft?: boolean }>).map((item) => (item.id === id ? { ...item, enabled, draft: enabled ? false : item.draft } : item)),
    }) as Partial<MemoryState>),

    remove: (list, id) => set((state) => ({
      [list]: (state[list] as Array<{ id: string }>).filter((item) => item.id !== id),
    }) as Partial<MemoryState>),

    retryKnowledge: (id) => {
      set((state) => ({ knowledge: state.knowledge.map((item) => (item.id === id ? { ...item, status: 'processing', failure: undefined } : item)) }))
      finishReading(id)
    },

    updateSkill: (id) => set((state) => ({
      skills: state.skills.map((skill) => (skill.id === id ? { ...skill, updateAvailable: false, updatedAt: stamp() } : skill)),
    })),

    copySkill: (id) => {
      const source = get().skills.find((skill) => skill.id === id)
      if (!source) return null
      const copyId = nextId('s')
      set((state) => ({
        skills: [{ ...source, id: copyId, name: `${source.name} (kopya)`, origin: 'mine', sharedBy: undefined, updateAvailable: false, enabled: false, draft: true, updatedAt: stamp() }, ...state.skills],
      }))
      return copyId
    },

    setIngestion: (patch) => set((state) => ({ ingestion: { ...state.ingestion, ...patch } })),
  }
})

/** Mock of "AI ile oluştur": turns a one-line request into a draft skill after a short wait. */
export async function draftSkillWithAi(request: string): Promise<Pick<SkillItem, 'name' | 'description' | 'steps'>> {
  await new Promise((resolve) => setTimeout(resolve, 1400))
  const clean = request.trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '')
  // Name: the request without its closing verb ("… kısa video yap" → "… kısa video"), at most five words.
  const words = clean.split(' ')
  if (words.length > 2 && /^(yap|hazırla|yaz|tanıt|oluştur|çıkar|üret|planla|anlat|düzenle)$/i.test(words[words.length - 1])) words.pop()
  const short = words.slice(0, 5).join(' ')
  const name = short.charAt(0).toLocaleUpperCase('tr') + short.slice(1)
  return {
    name,
    description: `${clean.charAt(0).toLocaleUpperCase('tr')}${clean.slice(1)}.`,
    steps: [
      'İsteğin amacını ve hedef kitleyi netleştir.',
      'Bellekteki ilgili bilgileri (marka sesi, menü, kurallar) topla.',
      `İşi yap: ${clean.charAt(0).toLocaleLowerCase('tr')}${clean.slice(1)}`,
      'Sonucu marka sesine ve kurallara göre kontrol et.',
    ],
  }
}
