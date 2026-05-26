// ============================================================
// tax.js — Tax calculation engine
// IRS Publication 15-T (2025), Publication 519
// ============================================================

const Tax = {

  // Main function — returns full tax picture for a gross amount
  calculate(grossIncome, settings = {}) {
    const s = {
      ficaExempt:       settings.fica_exempt      ?? APP_CONFIG.DEFAULTS.FICA_EXEMPT,
      stateTaxRate:     settings.state_tax_rate   ?? APP_CONFIG.DEFAULTS.STATE_TAX_RATE,
      hasTreaty:        settings.has_tax_treaty   ?? APP_CONFIG.DEFAULTS.HAS_TAX_TREATY,
      treatyAmount:     settings.treaty_amount    ?? APP_CONFIG.DEFAULTS.TREATY_AMOUNT,
      phantomAdd:       APP_CONFIG.DEFAULTS.NRA_PHANTOM_ANNUAL,
      brackets:         APP_CONFIG.DEFAULTS.FEDERAL_BRACKETS,
    };

    // Taxable income after treaty exemption
    const treatyDeduction  = s.hasTreaty ? Math.min(grossIncome, s.treatyAmount) : 0;
    const federalTaxable   = Math.max(0, grossIncome - treatyDeduction);

    // Federal tax (graduated brackets, no standard deduction for NRAs)
    const federalTax = this._applyBrackets(federalTaxable, s.brackets);

    // State tax (Colorado flat 4.4%)
    const stateTax = federalTaxable * s.stateTaxRate;

    // FICA (exempt for F-1 under 5 years)
    const ficaTax = s.ficaExempt ? 0 : grossIncome * 0.0765;

    const totalTax   = federalTax + stateTax + ficaTax;
    const takeHome   = grossIncome - totalTax;
    const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;

    return {
      grossIncome:    this._round(grossIncome),
      federalTax:     this._round(federalTax),
      stateTax:       this._round(stateTax),
      ficaTax:        this._round(ficaTax),
      totalTax:       this._round(totalTax),
      takeHome:       this._round(takeHome),
      effectiveRate:  this._round(effectiveRate * 100), // as percentage
      treatyDeduction: this._round(treatyDeduction),
    };
  },

  // Per-paycheck withholding estimate (NRA annualized method — IRS Pub 15-T)
  // This is what employers actually withhold — usually MORE than true liability
  estimateWithholding(periodicGross, payPeriodsPerYear = 26) {
    const annualized      = periodicGross * payPeriodsPerYear;
    const nraAdjusted     = annualized + APP_CONFIG.DEFAULTS.NRA_PHANTOM_ANNUAL;
    const federalOnAdj    = this._applyBrackets(nraAdjusted, APP_CONFIG.DEFAULTS.FEDERAL_BRACKETS);
    const perPeriodFed    = federalOnAdj / payPeriodsPerYear;
    const perPeriodState  = periodicGross * APP_CONFIG.DEFAULTS.STATE_TAX_RATE;
    const totalWithheld   = perPeriodFed + perPeriodState;
    const takeHome        = periodicGross - totalWithheld;

    return {
      gross:          this._round(periodicGross),
      federalHeld:    this._round(perPeriodFed),
      stateHeld:      this._round(perPeriodState),
      totalHeld:      this._round(totalWithheld),
      takeHome:       this._round(takeHome),
      withholdingRate: this._round((totalWithheld / periodicGross) * 100),
    };
  },

  // Estimate year-end refund/liability
  estimateRefund(ytdGross, ytdWithheld, taxableGross, settings = {}) {
    const trueOwed   = this.calculate(taxableGross, settings);
    const refund     = ytdWithheld - trueOwed.totalTax;
    return {
      trueOwed:       this._round(trueOwed.totalTax),
      withheld:       this._round(ytdWithheld),
      refundOrOwed:   this._round(refund),
      isRefund:       refund >= 0,
    };
  },

  // How many extra shifts needed to hit a goal
  shiftsNeeded(shortfall, hourlyRate, settings = {}) {
    if (shortfall <= 0) return { hours: 0, shifts8hr: 0, shifts6hr: 0 };
    // Work backwards from take-home needed
    const effectiveRate = settings.effective_rate || 0.22;
    const grossNeeded   = shortfall / (1 - effectiveRate);
    const hours         = Math.ceil(grossNeeded / hourlyRate);
    return {
      grossNeeded: this._round(grossNeeded),
      hours,
      shifts8hr: Math.ceil(hours / 8),
      shifts6hr: Math.ceil(hours / 6),
    };
  },

  _applyBrackets(income, brackets) {
    let tax = 0;
    let prev = 0;
    for (const bracket of brackets) {
      if (income <= prev) break;
      const taxable = Math.min(income, bracket.upTo) - prev;
      tax += taxable * bracket.rate;
      prev = bracket.upTo;
    }
    // Handle income above last bracket
    const lastBracket = brackets[brackets.length - 1];
    if (income > lastBracket.upTo) {
      tax += (income - lastBracket.upTo) * 0.24;
    }
    return tax;
  },

  _round(n) {
    return Math.round(n * 100) / 100;
  },

  // Tax treatment labels for UI
  TAX_TREATMENTS: {
    taxable: {
      label: 'Taxable',
      description: 'Counts toward your gross income and tax calculations.',
      color: '#e05c5c',
      icon: 'ti-receipt-tax',
    },
    informal: {
      label: 'Probably informal',
      description: 'Under $600 from one person — likely no 1099 issued. Tracked for your records but flagged.',
      color: '#e08c3c',
      icon: 'ti-help-circle',
    },
    excluded: {
      label: 'Excluded',
      description: 'You\'ve chosen to exclude this from tax calculations. Keep a record just in case.',
      color: '#5c9e6e',
      icon: 'ti-circle-off',
    },
  },
};
