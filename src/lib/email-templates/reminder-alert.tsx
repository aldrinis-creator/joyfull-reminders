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
  title?: string
  category?: string
  dueAt?: string
  offsetLabel?: string
}

const ReminderAlert = ({ recipientName, title, category, dueAt, offsetLabel }: Props) => {
  const name = recipientName?.trim() || 'there'
  const what = title?.trim() || 'Your reminder'
  const when = dueAt?.trim() || 'soon'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Reminder: ${what} — ${when}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>e-Reminder</Text>
          <Section style={card}>
            <Text style={eyebrow}>{offsetLabel?.trim() || 'Coming up'}</Text>
            <Heading style={heading}>{what}</Heading>
            <Hr style={divider} />
            <Text style={row}>
              <strong>When:</strong> {when}
            </Text>
            {category?.trim() ? (
              <Text style={row}>
                <strong>Category:</strong> {category}
              </Text>
            ) : null}
          </Section>
          <Text style={footer}>
            Hi {name} — this is your e-Reminder alert so nothing slips through.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReminderAlert,
  subject: (data: Record<string, any>) =>
    `Reminder: ${String(data?.['title'] ?? 'something coming up')}`,
  displayName: 'Reminder alert',
  previewData: {
    recipientName: 'Aldrin',
    title: "Meera's birthday",
    category: 'Personal & Family',
    dueAt: 'Sat, 12 Sep, 9:00 am',
    offsetLabel: '1 day before',
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
const heading = { margin: '0', fontSize: '24px', lineHeight: '30px', color: '#1F2440' }
const divider = { borderColor: '#E2543C', margin: '16px 0' }
const row = { margin: '0 0 8px', fontSize: '16px', lineHeight: '24px', color: '#1F2440' }
const footer = { marginTop: '24px', fontSize: '13px', color: '#6B7280' }
