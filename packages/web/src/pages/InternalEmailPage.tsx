import { Badge, Button, Card, Group, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { apiPost } from '../lib/api.js';
import type { InternalEmailRequest, InternalEmailResponse } from '../types/api.js';

const SUBJECT_LIMIT = 200;
const BODY_LIMIT = 5000;

export function InternalEmailPage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const subjectRemaining = useMemo(() => SUBJECT_LIMIT - subject.length, [subject]);
  const bodyRemaining = useMemo(() => BODY_LIMIT - body.length, [body]);

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      setLastError('Subject and body are required.');
      return;
    }

    setIsSubmitting(true);
    setLastError(null);
    setLastResult(null);

    try {
      await apiPost<InternalEmailResponse, InternalEmailRequest>('/internal/send-email', {
        subject: trimmedSubject,
        body: trimmedBody,
      });
      setLastResult('Email sent successfully.');
      setSubject('');
      setBody('');
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Failed to send email.');
    } finally {
      setIsSubmitting(false);
    }
  }, [body, subject]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs" mb={4}>
            <Title order={2}>Send Internal Email</Title>
            <Badge color="gray" variant="light">
              Internal
            </Badge>
          </Group>
          <Text c="dimmed" size="sm">
            Send an email from the system mailbox to the configured recipient.
          </Text>
        </div>
      </Group>

      <Card withBorder shadow="sm" padding="md">
        <Stack gap="md">
          <TextInput
            label="Subject"
            placeholder="Enter a subject"
            value={subject}
            onChange={(event) => setSubject(event.currentTarget.value)}
            maxLength={SUBJECT_LIMIT}
            description={`${subjectRemaining} characters remaining`}
            required
          />
          <Textarea
            label="Body"
            placeholder="Write the message body"
            value={body}
            onChange={(event) => setBody(event.currentTarget.value)}
            minRows={8}
            autosize
            maxLength={BODY_LIMIT}
            description={`${bodyRemaining} characters remaining`}
            required
          />
          <Group justify="space-between" align="center">
            <Button onClick={handleSubmit} loading={isSubmitting} disabled={!canSubmit}>
              Send email
            </Button>
            {lastResult ? (
              <Text size="sm" c="green">
                {lastResult}
              </Text>
            ) : null}
            {lastError ? (
              <Text size="sm" c="red">
                {lastError}
              </Text>
            ) : null}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
