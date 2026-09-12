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
  recipientName?: string
  reminders?: string[]
  occasions?: string[]
}

const WeeklyDigest = ({ recipientName, reminders = [], occasions = [] }: Props) => {
  const name = recipientName?.trim() || 'there'
  const total = reminders.length + occasions.length

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Your week ahead — ${total} thing${total === 1 ? '' : 's'} coming up`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>e-Reminder</Text>
          <Section style={card}>
            <Text style={eyebrow}>This week</Text>
            <Heading style={heading}>Hi {name}, here&apos;s your week ahead</Heading>
            <Hr style={divider} />

            {reminders.length > 0 ? (
              <>
                <Text style={sectionTitle}>Reminders</Text>
                {reminders.map((line) => (
                  <Text key={line} style={row}>
                    • {line}
                  </Text>
                ))}
              </>
            ) : null}

            {occasions.length > 0 ? (
              <>
                <Text style={sectionTitle}>Family occasions</Text>
                {occasions.map((line) => (
                  <Text key={line} style={row}>
                    • {line}
                  </Text>
                ))}
              </>
            ) : null}

            {total === 0 ? <Text style={row}>Nothing due this week 🎉</Text> : null}
          </Section>
          <Text style={footer}>
            You get this summary once a week so nothing slips through. You can turn email
            updates off any time in your e-Reminder profile.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WeeklyDigest,
  subject: (data: Record<string, any>) => {
    const count =
      (Array.isArray(data?.['reminders']) ? data['reminders'].length : 0) +
      (Array.isArray(data?.['occasions']) ? data['occasions'].length : 0)
    return count > 0
      ? `Your week ahead: ${count} thing${count === 1 ? '' : 's'} coming up`
      : 'Your week ahead'
  },
  displayName: 'Weekly digest',
  previewData: {
    recipientName: 'Aldrin',
    reminders: ['Mon, 14 Sep, 9:00 am — Adani electricity bill — ₹1,530'],
    occasions: ['Wed, 16 Sep, 9:00 am — Lira Alphonso’s birthday'],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 24px 32px', maxWidth: '560px' }
const brand = {
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  color: '#E2543C',
  margin: '0 0 16px',
}
const card = {
  backgroundColor: '#FFF7ED',
  border: '2px solid #E2543C',
  borderRadius: '16px',
  padding: '24px',
}
const eyebrow = {
  margin: '0 0 4px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#9A5B12',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}
const heading = { margin: '0', fontSize: '22px', lineHeight: '28px', color: '#1F2440' }
const divider = { borderColor: '#E2543C', margin: '16px 0' }
const sectionTitle = {
  margin: '16px 0 8px',
  fontSize: '14px',
  fontWeight: 700,
  color: '#9A5B12',
}
const row = { margin: '0 0 6px', fontSize: '16px', lineHeight: '24px', color: '#1F2440' }
const footer = { marginTop: '24px', fontSize: '13px', color: '#6B7280' }
