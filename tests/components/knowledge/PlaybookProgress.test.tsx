import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlaybookProgress, PlaybookProgressProps } from '../../../src/components/knowledge/PlaybookProgress';
import { PlaybookStep } from '../../../src/services/knowledge';

describe('PlaybookProgress Component', () => {
  const mockSteps: PlaybookStep[] = [
    {
      id: 'step-1',
      article_id: 'art-1',
      step_number: 1,
      title: 'Environment Setup',
      content: 'Install dependencies and configure environment variables.',
      checkpoint_instructions: 'Verify .env configuration file exists.',
    },
    {
      id: 'step-2',
      article_id: 'art-1',
      step_number: 2,
      title: 'Database Migration',
      content: 'Run setup script to create database tables.',
      checkpoint_instructions: null,
    },
    {
      id: 'step-3',
      article_id: 'art-1',
      step_number: 3,
      title: 'Verification Run',
      content: 'Execute test suite to confirm setup.',
      checkpoint_instructions: 'Check that all integration tests pass.',
    },
  ];

  const defaultProps: PlaybookProgressProps = {
    playbookTitle: 'Developer Onboarding Playbook',
    steps: mockSteps,
    completedStepIds: ['step-1'],
    onToggleStep: vi.fn(),
  };

  it('renders playbook title, progress percentage badge, progress bar, and sequential step list', () => {
    render(<PlaybookProgress {...defaultProps} />);

    expect(screen.getByTestId('playbook-header-card')).toBeInDocument();
    expect(screen.getByText('Developer Onboarding Playbook')).toBeInDocument();
    expect(screen.getByTestId('progress-badge')).toHaveTextContent('33% Completed');
    expect(screen.getByTestId('playbook-progress-bar')).toBeInDocument();
    expect(screen.getByTestId('steps-list')).toBeInDocument();
    expect(screen.getByTestId('step-item-step-1')).toBeInDocument();
    expect(screen.getByTestId('step-item-step-2')).toBeInDocument();
    expect(screen.getByTestId('step-item-step-3')).toBeInDocument();
  });

  it('displays completed badge for steps listed in completedStepIds', () => {
    render(<PlaybookProgress {...defaultProps} />);

    expect(screen.getByTestId('step-completed-badge-step-1')).toBeInDocument();
    expect(screen.queryByTestId('step-completed-badge-step-2')).not.toBeInDocument();
  });

  it('displays checkpoint verification instructions when checkpoint_instructions is present', () => {
    render(<PlaybookProgress {...defaultProps} />);

    expect(screen.getByTestId('checkpoint-step-1')).toHaveTextContent('Verify .env configuration file exists.');
    expect(screen.queryByTestId('checkpoint-step-2')).not.toBeInDocument();
  });

  it('calls onToggleStep when user clicks step completion toggle button', () => {
    const onToggleStep = vi.fn();
    render(<PlaybookProgress {...defaultProps} onToggleStep={onToggleStep} />);

    const step2Toggle = screen.getByTestId('step-toggle-step-2');
    fireEvent.click(step2Toggle);

    expect(onToggleStep).toHaveBeenCalledWith('step-2', false);
  });

  it('disables step toggle button during loading state when isUpdatingStepId matches step.id', () => {
    render(<PlaybookProgress {...defaultProps} isUpdatingStepId="step-2" />);

    const step2Toggle = screen.getByTestId('step-toggle-step-2');
    expect(step2Toggle).toBeDisabled();
  });

  it('allows navigating between steps using Previous and Next Step buttons', () => {
    render(<PlaybookProgress {...defaultProps} />);

    const prevBtn = screen.getByTestId('prev-step-btn');
    const nextBtn = screen.getByTestId('next-step-btn');

    expect(prevBtn).toBeDisabled(); // On first step
    expect(screen.getByTestId('step-counter-text')).toHaveTextContent('Step 1 of 3');

    fireEvent.click(nextBtn);
    expect(screen.getByTestId('step-counter-text')).toHaveTextContent('Step 2 of 3');
    expect(prevBtn).not.toBeDisabled();
  });

  it('renders empty notice when steps list is empty', () => {
    render(<PlaybookProgress steps={[]} />);

    expect(screen.getByTestId('playbook-progress-empty')).toHaveTextContent(
      'No playbook steps available for this guide.'
    );
  });
});
