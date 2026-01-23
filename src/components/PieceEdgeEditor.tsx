'use client';

import { useState, useCallback, useMemo } from 'react';
import { Popover, PopoverButton, PopoverPanel, Transition, RadioGroup } from '@headlessui/react';
import { Fragment } from 'react';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type EdgePosition = 'top' | 'right' | 'bottom' | 'left';

export type EdgeProfile =
  | 'none'
  | 'pencil_round'
  | 'bullnose'
  | 'arris'
  | 'bevel'
  | 'ogee'
  | 'mitered';

export type EdgeFinish = 'raw' | 'honed' | 'polished';

export interface EdgeConfig {
  profile: EdgeProfile;
  finish: EdgeFinish;
  lengthMm: number;
}

export interface EdgesConfig {
  top: EdgeConfig;
  right: EdgeConfig;
  bottom: EdgeConfig;
  left: EdgeConfig;
}

export interface PricingRule {
  id: number;
  category: string;
  name: string;
  price: number;
  priceType: string;
  description?: string;
}

export interface PieceEdgeEditorProps {
  lengthMm: number;
  widthMm: number;
  edges: EdgesConfig;
  onChange: (edges: EdgesConfig) => void;
  pricingRules?: PricingRule[];
  disabled?: boolean;
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const EDGE_PROFILES: { value: EdgeProfile; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'Raw unfinished edge' },
  { value: 'pencil_round', label: 'Pencil Round', description: 'Standard rounded edge' },
  { value: 'bullnose', label: 'Bullnose', description: 'Full rounded edge' },
  { value: 'arris', label: 'Arris', description: 'Slightly eased edge' },
  { value: 'bevel', label: 'Bevel', description: '45 degree bevel edge' },
  { value: 'ogee', label: 'Ogee', description: 'Decorative S-curve edge' },
  { value: 'mitered', label: 'Mitered', description: 'For thick appearance' },
];

const EDGE_FINISHES: { value: EdgeFinish; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'honed', label: 'Honed' },
  { value: 'polished', label: 'Polished' },
];

const PROFILE_TO_PRICING_NAME: Record<EdgeProfile, string> = {
  none: 'None',
  pencil_round: 'Pencil Round',
  bullnose: 'Bullnose',
  arris: 'Arris',
  bevel: 'Bevel',
  ogee: 'Ogee',
  mitered: 'Mitered',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDimension = (mm: number): string => {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)}m`;
  }
  return `${mm}mm`;
};

const getEdgeColor = (profile: EdgeProfile): string => {
  if (profile === 'none') return 'bg-gray-200 border-gray-300';
  return 'bg-primary-100 border-primary-500';
};

const getEdgeHoverColor = (profile: EdgeProfile): string => {
  if (profile === 'none') return 'hover:bg-gray-300';
  return 'hover:bg-primary-200';
};

const createDefaultEdge = (lengthMm: number): EdgeConfig => ({
  profile: 'none',
  finish: 'raw',
  lengthMm,
});

export const createDefaultEdges = (lengthMm: number, widthMm: number): EdgesConfig => ({
  top: createDefaultEdge(lengthMm),
  right: createDefaultEdge(widthMm),
  bottom: createDefaultEdge(lengthMm),
  left: createDefaultEdge(widthMm),
});

// ============================================
// SUB-COMPONENTS
// ============================================

interface EdgePopoverContentProps {
  edge: EdgeConfig;
  position: EdgePosition;
  onUpdate: (config: Partial<EdgeConfig>) => void;
  pricingRules?: PricingRule[];
  close: () => void;
}

const EdgePopoverContent = ({
  edge,
  position,
  onUpdate,
  pricingRules,
  close
}: EdgePopoverContentProps) => {
  const getPriceForProfile = (profile: EdgeProfile): number | null => {
    if (profile === 'none' || !pricingRules) return null;
    const ruleName = PROFILE_TO_PRICING_NAME[profile];
    const rule = pricingRules.find(
      r => r.category === 'edge_polish' && r.name === ruleName
    );
    return rule?.price ?? null;
  };

  const positionLabel = position.charAt(0).toUpperCase() + position.slice(1);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {positionLabel} Edge
        </h3>
        <span className="text-xs text-gray-500">
          {formatDimension(edge.lengthMm)}
        </span>
      </div>

      {/* Edge Profile Selection */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Edge Profile
        </label>
        <RadioGroup
          value={edge.profile}
          onChange={(value: EdgeProfile) => onUpdate({ profile: value })}
          className="space-y-1"
        >
          {EDGE_PROFILES.map((profile) => {
            const price = getPriceForProfile(profile.value);
            return (
              <RadioGroup.Option
                key={profile.value}
                value={profile.value}
                className={({ checked }) =>
                  `relative flex cursor-pointer rounded-lg px-3 py-2 border transition-colors focus:outline-none ${
                    checked
                      ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`
                }
              >
                {({ checked }) => (
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-sm">
                        <RadioGroup.Label
                          as="p"
                          className={`font-medium ${
                            checked ? 'text-primary-900' : 'text-gray-900'
                          }`}
                        >
                          {profile.label}
                        </RadioGroup.Label>
                        <RadioGroup.Description
                          as="span"
                          className={`text-xs ${
                            checked ? 'text-primary-700' : 'text-gray-500'
                          }`}
                        >
                          {profile.description}
                        </RadioGroup.Description>
                      </div>
                    </div>
                    {price !== null && (
                      <div className="text-xs text-gray-500">
                        ${price}/m
                      </div>
                    )}
                    {checked && (
                      <div className="shrink-0 text-primary-600 ml-2">
                        <CheckIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                )}
              </RadioGroup.Option>
            );
          })}
        </RadioGroup>
      </div>

      {/* Edge Finish Selection (only show if profile is not 'none') */}
      {edge.profile !== 'none' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Finish
          </label>
          <div className="flex gap-2">
            {EDGE_FINISHES.map((finish) => (
              <button
                key={finish.value}
                type="button"
                onClick={() => onUpdate({ finish: finish.value })}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  edge.finish === finish.value
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {finish.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={close}
          className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx={12} cy={12} r={12} fill="currentColor" opacity={0.2} />
    <path
      d="M7 13l3 3 7-7"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface EdgeIndicatorProps {
  config: EdgeConfig;
}

const EdgeIndicator = ({ config }: EdgeIndicatorProps) => {
  if (config.profile === 'none') return null;

  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700 truncate max-w-full">
      {PROFILE_TO_PRICING_NAME[config.profile]}
    </span>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const PieceEdgeEditor = ({
  lengthMm,
  widthMm,
  edges,
  onChange,
  pricingRules = [],
  disabled = false,
  className = '',
}: PieceEdgeEditorProps) => {
  const [activeEdge, setActiveEdge] = useState<EdgePosition | null>(null);

  // Calculate aspect ratio for the visual representation
  const aspectRatio = useMemo(() => {
    const maxSize = 200;
    const ratio = lengthMm / widthMm;

    if (ratio > 2) {
      return { width: maxSize, height: maxSize / 2 };
    } else if (ratio < 0.5) {
      return { width: maxSize / 2, height: maxSize };
    } else {
      return { width: maxSize, height: maxSize / ratio };
    }
  }, [lengthMm, widthMm]);

  // Update a single edge
  const updateEdge = useCallback(
    (position: EdgePosition, config: Partial<EdgeConfig>) => {
      const newEdges = {
        ...edges,
        [position]: {
          ...edges[position],
          ...config,
        },
      };
      onChange(newEdges);
    },
    [edges, onChange]
  );

  // Calculate edge costs
  const edgeCosts = useMemo(() => {
    const costs: Record<EdgePosition, number> = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };

    const positions: EdgePosition[] = ['top', 'right', 'bottom', 'left'];

    for (const pos of positions) {
      const edge = edges[pos];
      if (edge.profile !== 'none') {
        const ruleName = PROFILE_TO_PRICING_NAME[edge.profile];
        const rule = pricingRules.find(
          r => r.category === 'edge_polish' && r.name === ruleName
        );
        if (rule) {
          costs[pos] = (edge.lengthMm / 1000) * rule.price;
        }
      }
    }

    return costs;
  }, [edges, pricingRules]);

  const totalEdgeCost = useMemo(() => {
    return Object.values(edgeCosts).reduce((sum, cost) => sum + cost, 0);
  }, [edgeCosts]);

  const edgePolishRules = useMemo(() => {
    return pricingRules.filter(r => r.category === 'edge_polish');
  }, [pricingRules]);

  // Common edge styles
  const edgeBaseClass = `absolute transition-all duration-150 cursor-pointer border-2 ${
    disabled ? 'cursor-not-allowed opacity-50' : ''
  }`;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Visual Rectangle with Clickable Edges */}
      <div
        className="relative mx-auto"
        style={{
          width: aspectRatio.width + 40,
          height: aspectRatio.height + 40,
        }}
      >
        {/* Stone Piece Rectangle */}
        <div
          className="absolute bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 rounded shadow-inner"
          style={{
            left: 20,
            top: 20,
            width: aspectRatio.width,
            height: aspectRatio.height,
          }}
        >
          {/* Grain Direction Indicator */}
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <svg
              className="w-8 h-8 opacity-30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 12h16M12 4v16"
              />
            </svg>
          </div>

          {/* Dimensions Display */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs text-gray-600 whitespace-nowrap font-medium">
            L: {formatDimension(lengthMm)}
          </div>
          <div className="absolute -right-9 top-1/2 -translate-y-1/2 text-xs text-gray-600 whitespace-nowrap font-medium rotate-90 origin-center">
            W: {formatDimension(widthMm)}
          </div>
        </div>

        {/* Top Edge */}
        <Popover className="relative">
          {({ open, close }) => (
            <>
              <PopoverButton
                disabled={disabled}
                className={`${edgeBaseClass} ${getEdgeColor(edges.top.profile)} ${getEdgeHoverColor(edges.top.profile)} rounded-t-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1`}
                style={{
                  left: 20,
                  top: 10,
                  width: aspectRatio.width,
                  height: 12,
                }}
                onClick={() => setActiveEdge('top')}
              >
                <span className="sr-only">Edit top edge</span>
              </PopoverButton>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <PopoverPanel
                  className="absolute z-20 w-72 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5"
                  style={{
                    left: '50%',
                    transform: 'translateX(-50%)',
                    top: -10,
                  }}
                >
                  <EdgePopoverContent
                    edge={edges.top}
                    position="top"
                    onUpdate={(config) => updateEdge('top', config)}
                    pricingRules={edgePolishRules}
                    close={close}
                  />
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>

        {/* Right Edge */}
        <Popover className="relative">
          {({ open, close }) => (
            <>
              <PopoverButton
                disabled={disabled}
                className={`${edgeBaseClass} ${getEdgeColor(edges.right.profile)} ${getEdgeHoverColor(edges.right.profile)} rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1`}
                style={{
                  right: 8,
                  top: 20,
                  width: 12,
                  height: aspectRatio.height,
                }}
                onClick={() => setActiveEdge('right')}
              >
                <span className="sr-only">Edit right edge</span>
              </PopoverButton>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-x-1"
                enterTo="opacity-100 translate-x-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-x-0"
                leaveTo="opacity-0 translate-x-1"
              >
                <PopoverPanel
                  className="absolute z-20 w-72 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5"
                  style={{
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <EdgePopoverContent
                    edge={edges.right}
                    position="right"
                    onUpdate={(config) => updateEdge('right', config)}
                    pricingRules={edgePolishRules}
                    close={close}
                  />
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>

        {/* Bottom Edge */}
        <Popover className="relative">
          {({ open, close }) => (
            <>
              <PopoverButton
                disabled={disabled}
                className={`${edgeBaseClass} ${getEdgeColor(edges.bottom.profile)} ${getEdgeHoverColor(edges.bottom.profile)} rounded-b-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1`}
                style={{
                  left: 20,
                  bottom: 8,
                  width: aspectRatio.width,
                  height: 12,
                }}
                onClick={() => setActiveEdge('bottom')}
              >
                <span className="sr-only">Edit bottom edge</span>
              </PopoverButton>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <PopoverPanel
                  className="absolute z-20 w-72 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5"
                  style={{
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bottom: -10,
                  }}
                >
                  <EdgePopoverContent
                    edge={edges.bottom}
                    position="bottom"
                    onUpdate={(config) => updateEdge('bottom', config)}
                    pricingRules={edgePolishRules}
                    close={close}
                  />
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>

        {/* Left Edge */}
        <Popover className="relative">
          {({ open, close }) => (
            <>
              <PopoverButton
                disabled={disabled}
                className={`${edgeBaseClass} ${getEdgeColor(edges.left.profile)} ${getEdgeHoverColor(edges.left.profile)} rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1`}
                style={{
                  left: 8,
                  top: 20,
                  width: 12,
                  height: aspectRatio.height,
                }}
                onClick={() => setActiveEdge('left')}
              >
                <span className="sr-only">Edit left edge</span>
              </PopoverButton>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 -translate-x-1"
                enterTo="opacity-100 translate-x-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-x-0"
                leaveTo="opacity-0 -translate-x-1"
              >
                <PopoverPanel
                  className="absolute z-20 w-72 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5"
                  style={{
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <EdgePopoverContent
                    edge={edges.left}
                    position="left"
                    onUpdate={(config) => updateEdge('left', config)}
                    pricingRules={edgePolishRules}
                    close={close}
                  />
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>

      {/* Edge Summary */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-gray-700 mb-2">Edge Configuration</div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Top Edge */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Top:</span>
            <EdgeIndicator config={edges.top} />
            {edges.top.profile === 'none' && (
              <span className="text-gray-400">None</span>
            )}
          </div>
          <div className="text-right text-gray-600">
            {edgeCosts.top > 0 ? `$${edgeCosts.top.toFixed(2)}` : '-'}
          </div>

          {/* Right Edge */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Right:</span>
            <EdgeIndicator config={edges.right} />
            {edges.right.profile === 'none' && (
              <span className="text-gray-400">None</span>
            )}
          </div>
          <div className="text-right text-gray-600">
            {edgeCosts.right > 0 ? `$${edgeCosts.right.toFixed(2)}` : '-'}
          </div>

          {/* Bottom Edge */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Bottom:</span>
            <EdgeIndicator config={edges.bottom} />
            {edges.bottom.profile === 'none' && (
              <span className="text-gray-400">None</span>
            )}
          </div>
          <div className="text-right text-gray-600">
            {edgeCosts.bottom > 0 ? `$${edgeCosts.bottom.toFixed(2)}` : '-'}
          </div>

          {/* Left Edge */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Left:</span>
            <EdgeIndicator config={edges.left} />
            {edges.left.profile === 'none' && (
              <span className="text-gray-400">None</span>
            )}
          </div>
          <div className="text-right text-gray-600">
            {edgeCosts.left > 0 ? `$${edgeCosts.left.toFixed(2)}` : '-'}
          </div>
        </div>

        {/* Total */}
        {totalEdgeCost > 0 && (
          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center">
            <span className="text-xs font-medium text-gray-700">Edge Total:</span>
            <span className="text-sm font-semibold text-gray-900">
              ${totalEdgeCost.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            // Apply same profile to all edges
            const firstNonNoneEdge = Object.values(edges).find(e => e.profile !== 'none');
            if (firstNonNoneEdge) {
              onChange({
                top: { ...edges.top, profile: firstNonNoneEdge.profile, finish: firstNonNoneEdge.finish },
                right: { ...edges.right, profile: firstNonNoneEdge.profile, finish: firstNonNoneEdge.finish },
                bottom: { ...edges.bottom, profile: firstNonNoneEdge.profile, finish: firstNonNoneEdge.finish },
                left: { ...edges.left, profile: firstNonNoneEdge.profile, finish: firstNonNoneEdge.finish },
              });
            }
          }}
          className="flex-1 text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply to All
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(createDefaultEdges(lengthMm, widthMm))}
          className="flex-1 text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default PieceEdgeEditor;
