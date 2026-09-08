import React from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '../App.jsx';
import { PageHead } from '../ui.jsx';
import { InvestorTiers } from '../components/CreditPolicySection.jsx';

/* The graded fund list on its own screen; the same card also appears inside
   Settings, where the rest of the credit policy is configured. */
export default function Investors() {
  const me = useAuth();
  return (
    <div className="space-y-5">
      <PageHead icon={Building2} title="Investor tiers"
        subtitle="How well a fund backs its portfolio feeds the Rocket Fuel scorecard. The lead investor named on an application is matched against this list; anything ungraded scores neutral." />
      <InvestorTiers isDirector={me.role === 'director'} />
    </div>
  );
}
