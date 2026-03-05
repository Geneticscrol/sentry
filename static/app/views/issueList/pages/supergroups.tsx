import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {parseAsInteger, useQueryState} from 'nuqs';

import {FeatureBadge} from '@sentry/scraps/badge';
import {inlineCodeStyles} from '@sentry/scraps/code';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import useDrawer from 'sentry/components/globalDrawer';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import {IconFocus} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface ListSupergroupsResponse {
  data: SupergroupDetail[];
}

const supergroupQueryParser = parseAsInteger.withOptions({history: 'push'});

function SupergroupCard({supergroup}: {supergroup: SupergroupDetail}) {
  const location = useLocation();

  return (
    <CardContainer>
      <Stack padding="lg" gap="md">
        <CardTitleLink
          to={{
            pathname: location.pathname,
            query: {...location.query, supergroup: String(supergroup.id)},
          }}
        >
          {supergroup.title}
        </CardTitleLink>

        <Stack gap="xs">
          <Text size="xs" variant="muted">
            {tn('%s issue', '%s issues', supergroup.group_ids.length)}
          </Text>
          {supergroup.error_type && (
            <Flex align="baseline" gap="xs">
              <Text size="xs" variant="muted" bold>
                {t('Error:')}
              </Text>
              <Text size="xs" variant="muted">
                {supergroup.error_type}
              </Text>
            </Flex>
          )}
          {supergroup.code_area && (
            <Flex align="baseline" gap="xs">
              <Text size="xs" variant="muted" bold>
                {t('Location:')}
              </Text>
              <Text size="xs" variant="muted">
                {supergroup.code_area}
              </Text>
            </Flex>
          )}
        </Stack>

        {supergroup.summary && (
          <Container background="secondary" border="primary" radius="md">
            <Flex direction="column" padding="md lg" gap="sm">
              <Flex align="center" gap="xs">
                <IconFocus size="xs" variant="promotion" />
                <Text size="sm" bold>
                  {t('Root Cause')}
                </Text>
              </Flex>
              <Text size="sm">
                <StyledMarkedText text={supergroup.summary} inline as="span" />
              </Text>
            </Flex>
          </Container>
        )}
      </Stack>
    </CardContainer>
  );
}

function Supergroups() {
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
  const [selectedSupergroupId, setSelectedSupergroupId] = useQueryState(
    'supergroup',
    supergroupQueryParser
  );

  const {
    data: response,
    isPending,
    isError,
    refetch,
  } = useApiQuery<ListSupergroupsResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/seer/supergroups/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {
      staleTime: 60000,
    }
  );

  const supergroups = useMemo(() => response?.data ?? [], [response?.data]);

  const selectedSupergroup = useMemo(
    () => supergroups.find(sg => sg.id === selectedSupergroupId),
    [supergroups, selectedSupergroupId]
  );

  useEffect(() => {
    if (selectedSupergroupId === null || !selectedSupergroup) {
      return;
    }

    openDrawer(() => <SupergroupDetailDrawer supergroup={selectedSupergroup} />, {
      ariaLabel: t('Supergroup details'),
      drawerKey: 'supergroup-drawer',
      onClose: () => {
        void setSelectedSupergroupId(null, {history: 'replace'});
      },
      shouldCloseOnLocationChange: nextLocation => !nextLocation.query.supergroup,
    });
  }, [openDrawer, selectedSupergroupId, selectedSupergroup, setSelectedSupergroupId]);

  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  if (!hasTopIssuesUI) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <Layout.Page>
      <Layout.Header>
        <Flex align="center" gap="md" marginBottom="xl">
          <Heading as="h1">{t('Supergroups')}</Heading>
          <FeatureBadge type="experimental" />
          <FeedbackButton
            size="sm"
            feedbackOptions={{
              messagePlaceholder: t('What do you think about Supergroups?'),
              tags: {
                ['feedback.source']: 'supergroups',
                ['feedback.owner']: 'issues',
              },
            }}
          />
        </Flex>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main width="full">
          {isPending ? (
            <LoadingIndicator />
          ) : isError ? (
            <LoadingError onRetry={refetch} />
          ) : supergroups.length === 0 ? (
            <Container padding="lg" border="primary" radius="md" background="primary">
              <Text variant="muted" align="center" as="div">
                {t('No supergroups found')}
              </Text>
            </Container>
          ) : (
            <Stack gap="lg">
              <Text size="sm" variant="muted">
                {tn('%s supergroup', '%s supergroups', supergroups.length)}
              </Text>
              <CardGrid>
                {supergroups.map(sg => (
                  <SupergroupCard key={sg.id} supergroup={sg} />
                ))}
              </CardGrid>
            </Stack>
          )}
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

const CardGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const CardContainer = styled('div')`
  position: relative;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
    border-color: ${p => p.theme.tokens.border.accent.moderate};
    box-shadow: ${p => p.theme.dropShadowMedium};
  }
`;

const CardTitleLink = styled(Link)`
  font-size: ${p => p.theme.font.size.lg};
  font-weight: 600;
  color: ${p => p.theme.tokens.content.primary};
  line-height: 1.3;
  word-break: break-word;
  text-decoration: none;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }
`;

const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;

export default Supergroups;
