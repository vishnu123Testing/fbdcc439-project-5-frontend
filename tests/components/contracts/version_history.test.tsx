import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VersionHistory } from '../../../src/components/contracts/version_history';
import { DocumentVersionResponse } from '../../../src/services/contract_api';

describe('VersionHistory Component [FR-3, FR-4, FR-10]', () => {
  const sampleVersions: DocumentVersionResponse[] = [
    {
      id: 'ver-001',
      contract_id: 'cnt-101',
      category_type: 'Contract',
      version_number: 1,
      file_path: 's3://contracts/cnt-101/master_agreement_v1.pdf',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploaded_by_id: 'usr-legal-01',
      created_at: '2026-01-01T10:00:00Z',
    },
    {
      id: 'ver-002',
      contract_id: 'cnt-101',
      category_type: 'Contract',
      version_number: 2,
      file_path: 's3://contracts/cnt-101/master_agreement_v2.pdf',
      checksum: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
      uploaded_by_id: 'usr-legal-02',
      created_at: '2026-01-05T14:30:00Z',
    },
    {
      id: 'ver-003',
      contract_id: 'cnt-101',
      category_type: 'SOW',
      version_number: 1,
      file_path: 's3://contracts/cnt-101/statement_of_work_2026.pdf',
      checksum: '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d',
      uploaded_by_id: 'usr-pm-01',
      created_at: '2026-01-10T09:15:00Z',
    },
    {
      id: 'ver-004',
      contract_id: 'cnt-101',
      category_type: 'Exhibit',
      version_number: 1,
      file_path: 's3://contracts/cnt-101/sla_exhibit_a.pdf',
      checksum: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      uploaded_by_id: 'usr-legal-01',
      created_at: '2026-01-12T16:00:00Z',
    },
  ];

  const sampleAttachedDocs = [
    {
      id: 'att-001',
      title: 'Schedule A - SLA Metrics Exhibit',
      category: 'Exhibit',
      created_at: '2026-01-12T16:00:00Z',
    },
    {
      id: 'att-002',
      title: 'Statement of Work 2026 Cloud Services',
      category: 'SOW',
      created_at: '2026-01-10T09:15:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders contract header, active version banner, category badges, and version list [FR-3, FR-4]', () => {
    render(
      <VersionHistory
        contractId="cnt-101"
        contractTitle="Master Enterprise Services Agreement"
        contractCategory="Contract"
        documentVersions={sampleVersions}
        attachedDocuments={sampleAttachedDocs}
      />
    );

    expect(screen.getByTestId('version-history')).toBeInDocument();
    expect(screen.getByText('Master Enterprise Services Agreement')).toBeInDocument();
    expect(screen.getByText('Contract ID: cnt-101')).toBeInDocument();

    // Active version banner should be present for highest version or specified active version
    expect(screen.getByTestId('active-version-banner')).toBeInDocument();
    expect(screen.getByText('Active Document Version')).toBeInDocument();

    // Category filter pills should be present [FR-3]
    expect(screen.getByTestId('category-filter-all')).toBeInDocument();
    expect(screen.getByTestId('category-filter-contract')).toBeInDocument();
    expect(screen.getByTestId('category-filter-sow')).toBeInDocument();
    expect(screen.getByTestId('category-filter-nda')).toBeInDocument();
    expect(screen.getByTestId('category-filter-exhibit')).toBeInDocument();

    // Version items rendered
    expect(screen.getByTestId('version-item-ver-001')).toBeInDocument();
    expect(screen.getByTestId('version-item-ver-002')).toBeInDocument();
    expect(screen.getByTestId('version-item-ver-003')).toBeInDocument();
    expect(screen.getByTestId('version-item-ver-004')).toBeInDocument();
  });

  it('filters versions by category when category filter pill is clicked [FR-3]', () => {
    render(
      <VersionHistory
        contractId="cnt-101"
        contractTitle="Master Enterprise Services Agreement"
        documentVersions={sampleVersions}
      />
    );

    // Click SOW category filter
    fireEvent.click(screen.getByTestId('category-filter-sow'));

    // Only SOW version should be visible in filtered list
    expect(screen.getByTestId('version-item-ver-003')).toBeInDocument();
    expect(screen.queryByTestId('version-item-ver-001')).not.toBeInDocument();
    expect(screen.queryByTestId('version-item-ver-002')).not.toBeInDocument();
    expect(screen.queryByTestId('version-item-ver-004')).not.toBeInDocument();

    // Click Exhibit category filter
    fireEvent.click(screen.getByTestId('category-filter-exhibit'));
    expect(screen.getByTestId('version-item-ver-004')).toBeInDocument();
    expect(screen.queryByTestId('version-item-ver-003')).not.toBeInDocument();
  });

  it('filters versions by search query string', () => {
    render(
      <VersionHistory
        contractId="cnt-101"
        contractTitle="Master Enterprise Services Agreement"
        documentVersions={sampleVersions}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search file, version, hash/i);
    fireEvent.change(searchInput, { target: { value: 'master_agreement_v2' } });

    expect(screen.getByTestId('version-item-ver-002')).toBeInDocument();
    expect(screen.queryByTestId('version-item-ver-001')).not.toBeInDocument();
    expect(screen.queryByTestId('version-item-ver-003')).not.toBeInDocument();
  });

  it('submits new document version upload form and triggers onUploadVersion callback [FR-3, FR-4]', async () => {
    const handleUpload = vi.fn().mockResolvedValue(undefined);

    render(
      <VersionHistory
        contractId="cnt-101"
        contractTitle="Master Enterprise Services Agreement"
        documentVersions={sampleVersions}
        onUploadVersion={handleUpload}
      />
    );

    const categorySelect = screen.getByTestId('category-select');
    fireEvent.change(categorySelect, { target: { value: 'SOW' } });

    const fileInput = screen.getByTestId('upload-file-input');
    const dummyFile = new File(['dummy content'], 'statement_of_work_v2.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    const uploadButton = screen.getByTestId('upload-button');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(handleUpload).toHaveBeenCalledTimes(1);
      expect(handleUpload).toHaveBeenCalledWith(dummyFile, 'SOW');
    });

    expect(
      screen.getByText(/successfully uploaded new SOW version/i)
    ).toBeInDocument();
  });

  it('triggers onDownloadVersion callback when download button is clicked [FR-4]', async () => {
    const handleDownload = vi.fn().mockResolvedValue(undefined);

    render(
      <VersionHistory
        contractId="cnt-101"
        contractTitle="Master Enterprise Services Agreement"
        documentVersions={sampleVersions}
        onDownloadVersion={handleDownload}
      />
    );

    const downloadBtn = screen.getByTestId('download-button-ver-002');
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(handleDownload).toHaveBeenCalledWith(
        'ver-002',
        's3://contracts/cnt-101/master_agreement_v2.pdf'
      );
    });
  });

  it('switches to attachments tab and attaches supporting document to parent contract [FR-10]', async () => {
    const handleAttach = vi.fn().mockResolvedValue(undefined);

    render(
      <VersionHistory
        contractId="cnt-101"
        contractTitle="Master Enterprise Services Agreement"
        attachedDocuments={sampleAttachedDocs}
        onAttachSupportingDocument={handleAttach}
      />
    );

    // Switch to attachments tab
    const attachmentsTab = screen.getByTestId('tab-attachments');
    fireEvent.click(attachmentsTab);

    expect(screen.getByTestId('attached-documents-section')).toBeInDocument();
    expect(screen.getByText('Schedule A - SLA Metrics Exhibit')).toBeInDocument();
    expect(screen.getByText('Statement of Work 2026 Cloud Services')).toBeInDocument();

    // Fill out attach supporting document form
    const titleInput = screen.getByPlaceholderText(/Schedule A - SLA Exhibit/i);
    fireEvent.change(titleInput, { target: { value: 'Exhibit B - Security Policy' } });

    const categorySelect = screen.getByTestId('attach-category-select');
    fireEvent.change(categorySelect, { target: { value: 'Exhibit' } });

    const fileInput = screen.getByTestId('attach-file-input');
    const dummyExhibit = new File(['exhibit data'], 'security_policy.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [dummyExhibit] } });

    const attachButton = screen.getByTestId('attach-button');
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(handleAttach).toHaveBeenCalledTimes(1);
      expect(handleAttach).toHaveBeenCalledWith(
        dummyExhibit,
        'Exhibit',
        'Exhibit B - Security Policy'
      );
    });

    expect(
      screen.getByText(/successfully attached supporting Exhibit document/i)
    ).toBeInDocument();
  });

  it('renders unauthorized error banner when isUnauthorized prop is set to true [FR-1]', () => {
    render(
      <VersionHistory
        contractId="cnt-101"
        isUnauthorized={true}
        unauthorizedReason="You lack Procurement Manager privileges required to view document versions."
      />
    );

    expect(screen.getByTestId('unauthorized-message')).toBeInDocument();
    expect(screen.getByText('Access Restricted')).toBeInDocument();
    expect(
      screen.getByText(/You lack Procurement Manager privileges required to view document versions/i)
    ).toBeInDocument();
    expect(screen.queryByTestId('active-version-banner')).not.toBeInDocument();
  });
});
