# Frota SRE — Gestão de Viagens e Frota

Aplicação web responsiva para a SRE organizar solicitações antecipadas de viagens, aprovação pelo DAFI, alocação de veículos/motoristas e gestão da frota. Não substitui o PW/Prodemge: o registro oficial continua externo, e o sistema apenas guarda o controle interno e os dados do lançamento no PW.

Entrega em duas fases. A Fase 1 é funcional de ponta a ponta (banco, login, permissões, workflows). A Fase 2 acrescenta manutenção avançada, abastecimentos e relatórios.

## Premissas assumidas

- Login por e-mail e senha; o primeiro usuário cadastrado será promovido a Administrador DAFI.
- Papéis: SERVIDOR, DAFI (admin), e MOTORISTA como cadastro vinculado (não é papel de acesso na Fase 1).
- Dados demonstrativos incluídos: 4 veículos (PUE8477, OQM8523, QXW3H27, QXW3F17), 2 motoristas, 4 destinos e viagens pendentes/aprovadas/programadas, sem nomes reais.
- Notificações apenas dentro do sistema (sino + histórico na solicitação). Sem e-mail.
- Idioma pt-BR, datas e horários no formato brasileiro, fuso America/Sao_Paulo.

## Fase 1 — Núcleo funcional

### Acesso e perfis
- Tela de login/cadastro (e-mail e senha) e recuperação de senha.
- Perfil do servidor: nome, matrícula, setor, telefone.
- Papéis em tabela separada, com verificação no banco (evita escalonamento de privilégio).
- Menu lateral que muda conforme o perfil; rotas administrativas bloqueadas para servidores.

### Solicitação de viagem (servidor)
- Formulário: data, horário de saída, previsão de retorno, destino(s), motivo, ocupantes, condutor sugerido (opcional), observações.
- O servidor **não** escolhe veículo. Campos de veículo/motorista aparecem como "A DEFINIR PELO DAFI".
- Pode editar e cancelar enquanto estiver PENDENTE.
- "Minhas Solicitações" e "Minhas Viagens" mostram status e, após aprovação, veículo, placa, motorista e horários definitivos.

### Aprovação e alocação (DAFI)
- Fila de solicitações com filtros por status e período.
- Ações: aprovar, rejeitar (com motivo), solicitar correção.
- Ao aprovar, abre a etapa "Definir Transporte" com o resumo da solicitação e a lista de veículos calculada para o período:
  - disponíveis, selecionáveis;
  - ocupados/em manutenção/indisponíveis, exibidos apenas para informação, com o motivo (viagem, destino, horário, previsão de retorno);
  - incompatíveis por lotação, com a mensagem "Capacidade insuficiente — necessários N lugares" (motorista contado na ocupação).
- Define veículo, motorista, horário definitivo e observações; ao confirmar, o período fica reservado e a viagem vira PROGRAMADA.
- Troca posterior de veículo gera registro no histórico e notificação ao solicitante ("Anterior X → Novo Y").

### Regras de conflito
Verificadas no banco antes de gravar, e refletidas na interface:
1. sobreposição de horário do veículo; 2. sobreposição do motorista; 3. manutenção; 4. bloqueio administrativo; 5. capacidade.
Sobreposição parcial bloqueia com mensagem explicando o intervalo conflitante; períodos que não se cruzam são liberados. Pendentes e rejeitadas não reservam; canceladas liberam a reserva imediatamente.

### Veículos
- CRUD administrativo: placa, fabricante, modelo, ano, tipo, combustível, capacidade, patrimônio, km atual, foto, observações, status operacional, ativo/inativo.
- Status: DISPONÍVEL, RESERVADO, EM VIAGEM, EM MANUTENÇÃO, INDISPONÍVEL — calculados por data e horário, não como rótulo fixo.
- Ficha individual com abas: Visão Geral, Agenda, Viagens, Manutenções, Abastecimentos, Histórico. A aba Agenda lista todas as reservas futuras.

### Painéis de frota
- **Disponibilidade da Frota**: escolhe data, saída e retorno; lista separada em "Disponíveis para o período" e "Indisponíveis para o período" com o motivo de cada bloqueio.
- **Situação da Frota** no dashboard DAFI: cards por veículo com status atual e próxima viagem/previsão de retorno.
- **Agenda da Frota**: grade com veículos nas linhas e horários nas colunas, faixas coloridas por livre/reservado/em viagem/manutenção/indisponível.

### Motoristas, destinos e caronas
- Cadastro de motoristas e condutores autorizados (só autorizados podem ser escalados).
- Cadastro de destinos frequentes reutilizáveis na solicitação.
- Pedido de carona em viagem aprovada, com aprovação do DAFI e respeito à capacidade restante.

### PW/Prodemge, notificações e histórico
- Campo administrativo na viagem para registrar número/data do lançamento no PW e um marcador "lançado no PW".
- Central de notificações internas: aprovação, rejeição, pedido de correção, troca de veículo, decisão de carona.
- Toda decisão fica registrada em histórico. Nada é excluído fisicamente: usa cancelamento, inativação ou exclusão lógica.

## Fase 2 — Complementos

- Manutenção completa: "Colocar em manutenção" (entrada, previsão de retorno, oficina, cidade, motivo, km, observações) com alerta das viagens programadas afetadas, sem cancelá-las automaticamente; "Finalizar manutenção" (data, km, serviço, custo, observações) liberando o veículo quando não houver outro bloqueio; histórico preservado.
- Abastecimentos por veículo.
- Relatórios com filtro por período: viagens realizadas, por município, por setor, por veículo, por motorista, solicitações aprovadas/reprovadas, caronas, manutenções, abastecimentos — com estrutura pronta para exportação futura.
- Indicadores no dashboard.

## Detalhes técnicos

- Backend no Lovable Cloud (banco Postgres, autenticação e regras de acesso).
- Tabelas principais: `profiles`, `user_roles`, `vehicles`, `drivers`, `destinations`, `trip_requests`, `trip_occupants`, `trip_assignments`, `ride_requests`, `vehicle_blocks` (manutenção/indisponibilidade), `maintenance_records`, `fuel_records`, `notifications`, `audit_log`.
- Períodos gravados como `tstzrange`; conflito garantido por restrição de exclusão no banco (veículo e motorista), de modo que a sobreposição é impossível mesmo fora da interface.
- Segurança em nível de linha em todas as tabelas: servidor enxerga apenas os próprios registros e as viagens públicas; DAFI enxerga tudo. Verificação de papel por função `security definer` em tabela separada.
- Disponibilidade calculada por função no banco (`veiculos_disponiveis(inicio, fim, ocupantes)`) e reutilizada pelo painel de disponibilidade, pela etapa de aprovação e pela agenda.
- Front-end em TanStack Start com rotas protegidas, TanStack Query, formulários com validação (Zod + react-hook-form), componentes shadcn e tokens semânticos com suporte a tema claro/escuro.
- Dados demonstrativos inseridos por migração.

## Ordem de execução

1. Ativar o Lovable Cloud e criar o esquema com regras de acesso e dados demonstrativos.
2. Login, perfis, papéis e layout com menu lateral.
3. Solicitação de viagem e "Minhas Solicitações"/"Minhas Viagens".
4. Cadastros de veículos, motoristas e destinos.
5. Fila de aprovação e etapa "Definir Transporte" com verificação de conflitos.
6. Painéis: Disponibilidade da Frota, Situação da Frota, Agenda da Frota, ficha do veículo.
7. Caronas, registro PW/Prodemge, notificações e histórico.
8. Fase 2: manutenção, abastecimentos e relatórios.
