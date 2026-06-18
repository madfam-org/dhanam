export const capitalStack = {
  title: 'Capital Stack',
  subtitle:
    'Fluxos de capital entre linhas pessoais e entidades operacionais do proprietário–operador',
  empty: {
    title: 'Nenhum grupo de entidade',
    description:
      'Capital Stack conecta suas linhas de crédito pessoais a espaços empresariais para diários de capital auditáveis.',
    contactOps: 'Contate o operador da plataforma para configurar um grupo proprietário–operador.',
  },
  disabled: {
    title: 'Capital Stack indisponível',
    description: 'Este recurso não está habilitado no seu ambiente.',
  },
  metrics: {
    unreconciled: 'Fluxos não reconciliados',
    ownerFacilities: 'Contas de linha do proprietário',
    journals: 'Lançamentos do diário',
  },
  status: {
    draft: 'Rascunho',
    proposed: 'Proposto',
    matched: 'Conciliado',
    compliance_pending: 'Conformidade pendente',
    compliance_sealed: 'Selado',
    manual_review: 'Revisão manual',
    void: 'Anulado',
  },
  flowType: {
    capital_contribution: 'Aporte de capital',
    shareholder_loan: 'Empréstimo de acionista',
    loan_repayment: 'Pagamento de empréstimo',
    owner_draw: 'Retirada do proprietário',
    distribution: 'Distribuição',
  },
  journal: {
    title: 'Diário de capital',
    empty: 'Nenhum lançamento no diário',
    amount: 'Valor',
    flowType: 'Tipo de fluxo',
    status: 'Status',
    created: 'Criado',
    notes: 'Notas',
  },
  spaces: {
    personal: 'Espaço pessoal',
    business: 'Espaço empresarial',
  },
  owner: 'Proprietário beneficiário',
  refresh: 'Atualizar',
  loading: 'Carregando Capital Stack…',
  error: 'Não foi possível carregar o Capital Stack',
  accounts: {
    title: 'Classificação de contas',
    description: 'Marque contas por finalidade de capital para detecção e relatórios',
    save: 'Salvar classificações',
    saved: 'Classificações atualizadas',
    purpose: {
      personal_life: 'Vida pessoal',
      owner_facility: 'Linha do proprietário',
      entity_operating: 'Operação da entidade',
      equity_stake: 'Participação',
    },
  },
} as const;
