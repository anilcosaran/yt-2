'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

/** The main Chat's words (`Chat.copy.*`), shared by its page and its composer. */

export type ChatLocale = 'tr' | 'en'

export type ChatTranslator = (key: string, values?: Record<string, string | number>) => string

export function getChatCopy(t: ChatTranslator) {
  return {
    ready: t('copy.ready'),
    channelMissing: t('copy.channelMissing'),
    noMessages: t('copy.noMessages'),
    selectChannel: t('copy.selectChannel'),
    placeholder: t('copy.placeholder'),
    thinking: t('copy.thinking'),
    finishing: t('copy.finishing'),
    stopRun: t('copy.stopRun'),
    stoppingRun: t('copy.stoppingRun'),
    sendMessage: t('copy.sendMessage'),
    addContext: t('copy.addContext'),
    voice: t('copy.voice'),
    model: t('copy.model'),
    creditTitle: t('copy.creditTitle'),
    creditDescription: t('copy.creditDescription'),
    topUp: t('copy.topUp'),
    continueAfterTopUp: t('copy.continueAfterTopUp'),
    amountApprovalTitle: t('copy.amountApprovalTitle'),
    amountApprovalDescription: t('copy.amountApprovalDescription'),
    approveHigherAmount: t('copy.approveHigherAmount'),
    approvalTitle: t('copy.approvalTitle'),
    approvalDescription: t('copy.approvalDescription'),
    approve: t('copy.approve'),
    approvalProcessing: t('copy.approvalProcessing'),
    startApproved: t('copy.startApproved'),
    actionPendingTitle: t('copy.actionPendingTitle'),
    actionPendingDescription: t('copy.actionPendingDescription'),
    reject: t('copy.reject'),
    revise: t('copy.revise'),
    loadErrorTitle: t('copy.loadErrorTitle'),
    newChat: t('copy.newChat'),
    quickDecisionTitle: t('copy.quickDecisionTitle'),
    quickDecisionDefault: t('copy.quickDecisionDefault'),
    quickDecisionContinue: t('copy.quickDecisionContinue'),
    quickDecisionCustomPlaceholder: t('copy.quickDecisionCustomPlaceholder'),
    quickDecisionCustomSend: t('copy.quickDecisionCustomSend'),
    requiredFieldsTitle: t('copy.requiredFieldsTitle'),
    requiredFieldsPlaceholder: t('copy.requiredFieldsPlaceholder'),
    requiredFieldsSubmit: t('copy.requiredFieldsSubmit'),
    attachmentsTitle: t('copy.attachmentsTitle'),
    addMenuUpload: t('copy.addMenuUpload'),
    addMenuAssets: t('copy.addMenuAssets'),
    uploadingMedia: t('copy.uploadingMedia'),
    generatedEdit: t('copy.generatedEdit'),
    openMedia: t('copy.openMedia'),
    downloadMedia: t('copy.downloadMedia'),
    openOriginal: t('copy.openOriginal'),
    mediaPickerTitle: t('copy.mediaPickerTitle'),
    mediaPickerSearch: t('copy.mediaPickerSearch'),
    mediaPickerRecent: t('copy.mediaPickerRecent'),
    mediaPickerImages: t('copy.mediaPickerImages'),
    mediaPickerVideos: t('copy.mediaPickerVideos'),
    mediaPickerUploads: t('copy.mediaPickerUploads'),
    mediaPickerUpload: t('copy.mediaPickerUpload'),
    mediaPickerEmpty: t('copy.mediaPickerEmpty'),
    mediaPickerSelect: t('copy.mediaPickerSelect'),
    mediaPickerClose: t('copy.mediaPickerClose'),
    yes: t('copy.yes'),
    no: t('copy.no'),
    same: t('copy.same'),
    different: t('copy.different'),
    sameValue: t('copy.sameValue'),
    differentValue: t('copy.differentValue'),
    quickDecisionDefaultValue: t('copy.quickDecisionDefaultValue'),
    quickDecisionContinueValue: t('copy.quickDecisionContinueValue'),
  }
}

export type ChatCopy = ReturnType<typeof getChatCopy>

export function useChatCopy() {
  const t = useTranslations('Chat') as unknown as ChatTranslator
  return React.useMemo(() => getChatCopy(t), [t])
}
