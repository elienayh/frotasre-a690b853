# Evolução do Frota SRE — ocupantes, credenciamento, motorista por destino e ciclo de vida do veículo

Evolução incremental sobre o sistema existente. Nada é recriado: as tabelas atuais (`trip_requests`, `trip_stops`, `profiles`, `vehicles`, `vehicle_blocks`, `fuel_records`, `ride_requests`, `notifications`, `trip_history`, escalas) são reaproveitadas e estendidas.

## O que já existe hoje (verificado)

- A viagem já grava saída e retorno (`departure_at` / `return_at`), inclusive em dias diferentes — o que falta é a **interface**, que hoje usa uma única data e só varia o horário (formulário de solicitação e diálogo de aprovação).
- Ocupantes hoje são **texto livre** (`occupants_names`) — não há vínculo com usuários.
- Cada destino/parada (`trip_stops`) **não tem motorista próprio**.
- O perfil tem "Motorista da SRE", mas **não existe** o atributo "Credenciado para dirigir".
- Veículo tem odômetro e tipo, mas **não há** próxima manutenção por km, km médio, nem tipos de manutenção categorizados.
- O menu tem "Agenda da Frota" e "Disponibilidade da Frota" separados.

## Entregas por fase

### Fase 1 — Pessoas, credenciamento e ocupantes

- Novo atributo de perfil **Credenciado para dirigir**, independente de "Motorista da SRE". Alterável por Admin, Super Admin e Motoristas da SRE; bloqueado para usuário comum no frontend **e** nas policies. Cada mudança grava no histórico de permissões (quem, quando, valor anterior/novo).
- Toda lista de escolha de motorista passa a mostrar **somente usuários ativos e credenciados**, com o selo "Credenciado".
- Nova tabela de **ocupantes da viagem** vinculada a usuários. Ao informar o número de ocupantes, o formulário abre um campo por ocupante, todos obrigatórios (envio bloqueado enquanto houver vazio), com busca por nome, matrícula, e-mail e setor, sem inativos e sem repetir a mesma pessoa.
- **Ocupante externo** (nome, documento, telefone, observação) apenas para Admin/Super Admin, sinalizado como "OCUPANTE EXTERNO" em todas as telas.
- O texto livre atual de ocupantes é preservado como observação histórica das viagens já existentes.
- Notificações: inclusão como ocupante, remoção, e recusa ("Não vou participar", com confirmação) notificando o solicitante; tudo registrado no histórico.
- Edição de ocupantes após a criação por Admin, Super Admin e Motoristas da SRE.
- Lista de ocupantes exibida em Aprovações, Detalhes da viagem, Viagens Programadas, Calendário, Organização do Dia e detalhes administrativos — usuário comum vê, não edita.

### Fase 2 — Datas, motorista por destino e aprovações

- Formulário de solicitação e diálogo de aprovação passam a ter **data da viagem + data de retorno** separadas, com validação (retorno ≥ saída), refletidas em Aprovações, Viagens Programadas, Calendário, Disponibilidade da Frota, Organização do Dia, Detalhes e Notificações. Viagens de vários dias aparecem em todos os dias do período no calendário.
- Campo de motorista sai de "Quem vai". A solicitação nasce com **DAFI DEFINIR**.
- Cada destino passa a ter **motorista próprio**, também iniciando como "DAFI DEFINIR", editável depois conforme permissão.
- Ficha de aprovação completa: solicitante, data da viagem, data de retorno, destinos com motorista e horário, veículo/tipo de transporte, ocupantes, motivo, status, aprovado por, data da aprovação, organizado por. Edição do motorista de cada destino direto na ficha.
- Card de aprovação **inteiro clicável**, com destaque visual de hover/cursor.
- Tipo de transporte ganha **Ônibus** (além de Carro e Van), persistido e exibido em todas as telas.
- **Contagem de lotação**: motorista conta como pessoa a bordo, listado à parte dos ocupantes (Capacidade / Motorista / Ocupantes / Total). Na aprovação e na organização, capacidade excedida **bloqueia** a confirmação do veículo, com exceção apenas para a permissão administrativa já existente.
- Seção **Solicitações de Carona** dentro de Aprovações (solicitante, viagem, destino, data, motivo, status, ocupante pretendido) com Aprovar/Recusar; notificação para Admin/Super Admin ao solicitar e para o solicitante na decisão.

### Fase 3 — Navegação

- **Calendário de Viagens vira a tela inicial** após o login, para todos os perfis, com detalhes, ocupantes, cidade, destino, motorista, veículo e pedido de carona quando permitido — sem expor dados administrativos a usuário comum.
- **"Agenda da Frota" deixa de ser um menu**: seu conteúdo (viagens, horários ocupados e livres, manutenção, previsão de liberação, agenda operacional) é incorporado à **Disponibilidade da Frota**, em abas dentro da mesma tela.

### Fase 4 — Veículos: manutenção e abastecimento

- Odômetro atualizável com **histórico de alterações**.
- **Manutenção preventiva por km**: próxima manutenção, km restante e **barra de progresso** que muda de cor ao se aproximar do limite e exibe "MANUTENÇÃO VENCIDA" ao ultrapassar.
- **Tipos de manutenção** registráveis individualmente (pneus, óleo, filtro de óleo, filtro de ar, alinhamento, balanceamento, outros) com data, km, descrição, próxima data, próximo km, observações e responsável. Registro permitido a Admin e Motoristas da SRE, atualizando automaticamente a previsão seguinte.
- Lista de veículos mostra km atual, próxima manutenção, km restante e qual serviço vem a seguir.
- **Abastecimento**: data, km, litros, tipo de combustível, valor, posto e observações; novo campo **Km médio** no veículo; previsão do próximo abastecimento calculada e editável manualmente.
- **Alerta de combustível abaixo de 1/4** — estimativa por km rodado desde o último abastecimento, explicitada como estimativa (não há sensor), com alerta visual e notificação.
- **Painel resumo do veículo** com odômetro, combustível estimado, próxima manutenção, próximo abastecimento, km médio e status.
- Notificações de veículo: manutenção próxima, manutenção vencida, combustível baixo, abastecimento se aproximando, entrada e retorno de manutenção.

### Fase 5 — Permissões e histórico

- Matriz de permissões aplicada no frontend **e** nas policies do banco: Admin/Super Admin (aprovar e editar viagens, ocupantes, credenciamento, veículos, manutenção, abastecimento, organização), Motorista da SRE (organizar suas viagens, consultar, editar ocupantes, credenciar, manutenção, abastecimento, dados operacionais do veículo), usuário comum (solicitar, selecionar ocupantes, ver suas viagens, notificações, carona, recusar participação) — sem qualquer alteração administrativa.
- **Histórico unificado** de toda ação relevante (ocupantes, motorista, veículo, aprovação, rejeição, manutenção, abastecimento, credenciamento, horário, destino) com responsável, data, hora, ação, valor anterior e novo valor, visível nos detalhes da viagem e na ficha do veículo.

## Detalhes técnicos

- Migrações aditivas, sem apagar dados: `profiles.is_driver_certified`; `trip_stops.driver_user_id`; `trip_requests` ganha campos de apoio de período/transporte quando necessário (o par `departure_at`/`return_at` continua sendo a fonte das datas); `vehicles` ganha `next_maintenance_km`, `avg_km_per_liter`, `next_refuel_km`, `tank_capacity`; novas tabelas `trip_occupants` (usuário ou externo, status incluído/recusado), `maintenance_records`, `odometer_history`; `fuel_records` estendido.
- Todo `CREATE TABLE` acompanha `GRANT` + RLS + policies escritas com as funções `has_role`/coordenador já existentes; nenhuma regra fica apenas no frontend.
- Notificações continuam no sino atual (tabela `notifications` + realtime), apenas com novos tipos e `link` para a viagem/veículo correspondente; disparo por trigger `SECURITY DEFINER`, como já é feito hoje.
- `DriverPicker` passa a filtrar por ativo + credenciado; `TripForm` troca o texto livre de ocupantes pelo seletor por usuário; `TripStops` ganha o seletor de motorista por parada.
- Alertas de manutenção/combustível calculados por função no banco e reavaliados a cada registro de odômetro/abastecimento, para valerem também fora da interface.

## Ordem de execução

Fases 1 → 2 → 3 → 4 → 5, cada uma entregue e verificável antes da seguinte. As fases 1 e 2 mudam o fluxo central de solicitação/aprovação; 3 é navegação; 4 e 5 completam frota, permissões e auditoria.
