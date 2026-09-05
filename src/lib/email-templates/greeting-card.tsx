import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  senderName?: string
  recipientName?: string
  occasion?: string
  message?: string
  cardStyle?: string
  greetingUrl?: string
  voiceUrl?: string
}


const CARD_ACCENTS: Record<string, { bg: string; border: string }> = {
  sunrise: { bg: '#FFF7ED', border: '#F59E0B' },
  bloom: { bg: '#FDF2F8', border: '#EC4899' },
  festive: { bg: '#EEF2FF', border: '#6366F1' },
  classic: { bg: '#F0FDFA', border: '#14B8A6' },
}

const GreetingCard = ({ senderName, recipientName, occasion, message, cardStyle, greetingUrl, voiceUrl }: Props) => {
  const accent = CARD_ACCENTS[cardStyle ?? 'classic'] ?? CARD_ACCENTS['classic']!
  const greetingTo = recipientName?.trim() || 'you'
  const greetingFrom = senderName?.trim() || 'Someone who cares'
  const occasionLabel = occasion?.trim() || 'a special day'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${greetingFrom} sent you a greeting for ${occasionLabel}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>e-Reminder</Text>
          <Section style={{ ...card, backgroundColor: accent.bg, borderColor: accent.border }}>
            <Heading style={heading}>Happy {occasionLabel}, {greetingTo}!</Heading>
            <Hr style={{ ...divider, borderColor: accent.border }} />
            <Text style={messageText}>
              {message?.trim() || 'Thinking of you today and wishing you the very best.'}
            </Text>
            {voiceUrl ? (
              <Section>
                <Text style={messageText}>
                  🎙️ {greetingFrom} recorded a voice message for you.
                </Text>
                {/* Some clients play this inline; the rest fall back to the link. */}
                <audio controls src={voiceUrl} style={{ width: '100%' }} />
                {greetingUrl ? (
                  <Text style={messageText}>
                    <a href={greetingUrl} style={{ color: accent.border }}>
                      Open your card to listen
                    </a>
                  </Text>
                ) : null}
              </Section>
            ) : null}
            <Text style={signature}>— {greetingFrom}</Text>
          </Section>
          <Text style={footer}>
            Sent with e-Reminder — never miss a moment that matters.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}


export const template = {
  component: GreetingCard,
  subject: (data: Record<string, any>) =>
    `${data?.['senderName'] || 'Someone'} sent you a greeting${data?.['occasion'] ? ` for ${data['occasion']}` : ''}`,
  displayName: 'Greeting card',
  previewData: {
    senderName: 'Asha',
    recipientName: 'Rahul',
    occasion: 'Birthday',
    message: 'Wishing you a year full of laughter and good health!',
    cardStyle: 'festive',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '24px 20px', maxWidth: '560px', margin: '0 auto' }
const brand = { color: '#0F766E', fontSize: '14px', fontWeight: 'bold' as const, letterSpacing: '1px' }
const card = {
  border: '2px solid',
  borderRadius: '12px',
  padding: '28px 24px',
  marginTop: '16px',
}
const heading = { color: '#1F2937', fontSize: '24px', margin: '0 0 8px' }
const divider = { margin: '12px 0' }
const messageText = { color: '#374151', fontSize: '16px', lineHeight: '26px' }
const signature = { color: '#6B7280', fontSize: '14px', fontStyle: 'italic' as const, marginTop: '20px' }
const footer = { color: '#9CA3AF', fontSize: '12px', marginTop: '24px', textAlign: 'center' as const }
