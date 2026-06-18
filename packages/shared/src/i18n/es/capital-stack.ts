export const capitalStack = {
  title: 'Capital Stack',
  subtitle:
    'Flujos de capital entre facilidades personales y entidades operativas del dueño–operador',
  empty: {
    title: 'Sin grupos de entidad',
    description:
      'Capital Stack vincula tus líneas de crédito personales con espacios de negocio para diarios de capital auditables.',
    contactOps: 'Contacta al operador de plataforma para configurar un grupo dueño–operador.',
  },
  disabled: {
    title: 'Capital Stack no disponible',
    description: 'Esta función no está habilitada en tu entorno.',
  },
  metrics: {
    unreconciled: 'Flujos sin conciliar',
    ownerFacilities: 'Cuentas de facilidad del dueño',
    journals: 'Entradas del diario',
  },
  status: {
    draft: 'Borrador',
    proposed: 'Propuesto',
    matched: 'Conciliado',
    compliance_pending: 'Cumplimiento pendiente',
    compliance_sealed: 'Sellado',
    manual_review: 'Revisión manual',
    void: 'Anulado',
  },
  flowType: {
    capital_contribution: 'Aportación de capital',
    shareholder_loan: 'Préstamo accionista',
    loan_repayment: 'Pago de préstamo',
    owner_draw: 'Retiro del dueño',
    distribution: 'Distribución',
  },
  journal: {
    title: 'Diario de capital',
    empty: 'Sin entradas en el diario',
    amount: 'Monto',
    flowType: 'Tipo de flujo',
    status: 'Estado',
    created: 'Creado',
    notes: 'Notas',
  },
  spaces: {
    personal: 'Espacio personal',
    business: 'Espacio de negocio',
  },
  owner: 'Dueño beneficiario',
  refresh: 'Actualizar',
  loading: 'Cargando Capital Stack…',
  error: 'No se pudo cargar Capital Stack',
  accounts: {
    title: 'Clasificación de cuentas',
    description: 'Etiqueta cuentas por propósito de capital para detección y reportes',
    save: 'Guardar clasificaciones',
    saved: 'Clasificaciones actualizadas',
    purpose: {
      personal_life: 'Vida personal',
      owner_facility: 'Facilidad del dueño',
      entity_operating: 'Operación de entidad',
      equity_stake: 'Participación',
    },
  },
} as const;
