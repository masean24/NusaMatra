// Data Hub contract v2.4 (deployed ce49cdf, samples received 2026-10-28, SHA-256 of the archive
// f974df85ca58e77565b74fa1c1963b60550b8d5b1d4cfc07ab7be81d73efecbc): every error now uses one
// envelope { status, code, message, detail? } with `detail` a string, and meta carries
// boundary_version. These tests pin that the frontend reads the new shapes.

import notFound from './__fixtures__/contract-v2.4/error_not_found.json';
import validationQuery from './__fixtures__/contract-v2.4/error_validation_query.json';
import validationWeight from './__fixtures__/contract-v2.4/error_validation_weight.json';
import regionDetail from './__fixtures__/contract-v2.4/meta_region_detail.json';
import snapshots from './__fixtures__/contract-v2.4/meta_snapshots.json';
import { mapHttpErrorResponse } from './apiError';
import { mapEnvelope, mapRegionDetailData } from './domainMappers';

const NO_HEADERS = { requestId: null, dataFallback: null, serverMode: null } as const;
const parse = (sample: { readonly http_status: number; readonly body: unknown }) =>
  mapHttpErrorResponse(sample.http_status, sample.body, NO_HEADERS);

describe('Data Hub contract v2.4 error envelope', () => {
  it('reads a query validation error: code, status and the server message', () => {
    const error = parse(validationQuery);
    expect(error.status).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.isValidationError).toBe(true);
    expect(error.serverMessage).toBe('Request validation failed.');
  });

  it('reads a weight validation error as one the Lab can explain', () => {
    const error = parse(validationWeight);
    expect(error.status).toBe(422);
    // The frontend refines a "weights must sum to 10000" message into its own WEIGHT_SUM_INVALID.
    expect(['WEIGHT_VALIDATION_ERROR', 'WEIGHT_SUM_INVALID']).toContain(error.code);
    expect(error.isValidationError).toBe(true);
    expect(error.serverMessage).toContain('10000 basis points');
  });

  it('reads a missing indicator as NOT_FOUND', () => {
    const error = parse(notFound);
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });
});

describe('Data Hub contract v2.4 region detail (archive 74dd6b53…, score_direction patch)', () => {
  it('reads meta.score_direction', () => {
    const envelope = mapEnvelope(
      regionDetail.body,
      'LIVE',
      {
        status: 200,
        requestId: null,
        dataFallback: null,
        serverMode: null,
        clientReceivedAt: '2026-10-28T00:00:00Z',
      },
      (data, meta) => mapRegionDetailData(data, meta),
    );
    expect(envelope.meta.scoreDirection).toBe('higher_is_need');
  });
});

describe('Data Hub contract v2.4 meta', () => {
  it('names the boundary version and marks exactly one active snapshot', () => {
    expect(snapshots.body.meta.boundary_version).toBe('BIG-20260601');
    const active = snapshots.body.data.filter((entry) => entry.is_active_default);
    expect(active).toHaveLength(1);
    expect(active[0]?.snapshot_id).toBe(snapshots.body.meta.snapshot_id);
  });
});
