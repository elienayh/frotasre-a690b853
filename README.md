# FrotaSRE

==================================================

6. PROCESSO DE APROVAÇÃO E ALOCAÇÃO DO VEÍCULO

==================================================

IMPORTANTE:

O usuário NÃO escolhe o veículo ao fazer uma solicitação de viagem.

O servidor informa apenas sua necessidade de deslocamento:

- data;

- horário de saída;

- previsão de retorno;

- destino(s);

- motivo;

- ocupantes;

- motorista/condutor sugerido, quando aplicável.

A escolha e a alocação do veículo são responsabilidade do DAFI.

FLUXO:

1. Servidor cria a solicitação.

2. Solicitação fica PENDENTE.

3. DAFI analisa a solicitação.

4. DAFI aprova ou rejeita.

5. Ao aprovar, o administrador deve definir:

   - veículo;

   - motorista/condutor;

   - horário definitivo;

   - observações, quando necessário.

6. Após a alocação, o veículo fica RESERVADO para aquele período.

7. O solicitante passa a visualizar qual veículo foi destinado à sua viagem.

Exemplo:

SOLICITAÇÃO APROVADA

Destino:

SEE - Belo Horizonte

Saída:

12/08/2026 às 06:00

Retorno previsto:

12/08/2026 às 20:00

Veículo:

Fiat Strada

Placa:

PUE8477

Motorista:

Fabiano

Status:

PROGRAMADA

O usuário poderá consultar essas informações em:

"Minhas Solicitações" e "Minhas Viagens".

==================================================

7. CADASTRO E GESTÃO DE VEÍCULOS

==================================================

Criar módulo administrativo:

"Veículos"

Somente administradores poderão cadastrar, editar, ativar ou inativar veículos.

Cada veículo deverá possuir:

- placa;

- fabricante;

- modelo;

- ano;

- tipo;

- combustível;

- capacidade de passageiros;

- patrimônio, se aplicável;

- quilometragem atual;

- foto;

- observações;

- status operacional;

- ativo/inativo.

Exemplo:

Fiat Strada

PUE8477

5 lugares

Diesel

KM atual: 133.065

STATUS: DISPONÍVEL

Criar os seguintes status operacionais:

DISPONÍVEL

RESERVADO

EM VIAGEM

EM MANUTENÇÃO

INDISPONÍVEL

Os status devem possuir regras próprias.

DISPONÍVEL:

Pode ser alocado para uma viagem.

RESERVADO:

Possui viagem programada para determinado período.

Pode continuar disponível para outros períodos que não tenham conflito de horário.

EM VIAGEM:

Está sendo utilizado naquele momento.

EM MANUTENÇÃO:

Não pode ser alocado para nenhuma viagem durante o período de manutenção.

INDISPONÍVEL:

Bloqueado administrativamente por outro motivo.

IMPORTANTE:

Não tratar "RESERVADO" apenas como um status fixo global.

A disponibilidade deve considerar DATA + HORÁRIO.

Exemplo:

PUE8477 possui viagem:

12/08/2026

07:00 às 14:00

Portanto:

07:00–14:00 = OCUPADO

Após 14:00 = poderá estar LIVRE novamente, desde que não exista outra reserva, viagem, manutenção ou indisponibilidade.

==================================================

8. PAINEL DE DISPONIBILIDADE DA FROTA

==================================================

Criar uma tela administrativa chamada:

"Disponibilidade da Frota"

Essa tela é essencial para o DAFI.

O administrador deve conseguir selecionar:

DATA

HORÁRIO DE SAÍDA

HORÁRIO PREVISTO DE RETORNO

Após informar o período, mostrar automaticamente todos os veículos separados por disponibilidade.

Exemplo:

DISPONÍVEIS PARA O PERÍODO

✓ PUE8477

  Fiat Strada

  5 lugares

  DISPONÍVEL

✓ OQM8523

  Fiat Palio

  5 lugares

  DISPONÍVEL

INDISPONÍVEIS PARA O PERÍODO

✕ QXW3H27

  Fiat Cronos

  OCUPADO

  Viagem: Belo Horizonte

  06:00–20:00

✕ QXW3F17

  Fiat Strada

  EM MANUTENÇÃO

  Retorno previsto: 15/08/2026

O administrador deve conseguir identificar rapidamente:

- quais veículos estão livres;

- quais estão ocupados;

- qual viagem está utilizando cada veículo;

- horário previsto de retorno;

- quais estão em manutenção;

- quais estão administrativamente indisponíveis.

==================================================

9. ALOCAÇÃO DO VEÍCULO DURANTE A APROVAÇÃO

==================================================

Ao administrador clicar em:

"APROVAR SOLICITAÇÃO"

abrir uma etapa:

"Definir Transporte"

Mostrar os dados da solicitação:

Data:

12/08/2026

Saída:

07:00

Retorno:

17:00

Destino:

Espera Feliz

Ocupantes:

4 pessoas

Em seguida mostrar:

VEÍCULOS DISPONÍVEIS

O sistema deve calcular automaticamente quais veículos podem atender à solicitação.

Exemplo:

✓ PUE8477

Fiat Strada

5 lugares

LIVRE NO PERÍODO

[ SELECIONAR ]

✓ OQM8523

Fiat Palio

5 lugares

LIVRE NO PERÍODO

[ SELECIONAR ]

✕ QXW3H27

Fiat Cronos

OCUPADO

Viagem para Belo Horizonte

06:00–20:00

✕ QXW3F17

Fiat Strada

EM MANUTENÇÃO

Veículos ocupados, em manutenção ou indisponíveis devem aparecer para informação do administrador, mas não podem ser selecionados.

==================================================

10. VERIFICAÇÃO AUTOMÁTICA DE CONFLITOS

==================================================

Antes de confirmar uma alocação, verificar:

1. conflito de horário do veículo;

2. conflito de horário do motorista;

3. manutenção;

4. indisponibilidade administrativa;

5. capacidade do veículo.

Não permitir duas viagens utilizando o mesmo veículo em horários conflitantes.

Exemplo:

Viagem A:

PUE8477

08:00–12:00

Nova viagem:

PUE8477

10:00–14:00

Resultado:

BLOQUEAR.

Mensagem:

"Este veículo já está reservado para outra viagem entre 08:00 e 12:00."

Porém:

Viagem A:

08:00–12:00

Nova viagem:

14:00–18:00

Resultado:

PERMITIR, desde que não exista outra restrição.

==================================================

11. CAPACIDADE DO VEÍCULO

==================================================

A capacidade cadastrada deve participar da sugestão de disponibilidade.

Exemplo:

Solicitação:

6 ocupantes

Veículo:

5 lugares

Resultado:

Veículo incompatível com a quantidade de ocupantes.

Não permitir sua seleção.

Considerar o motorista na ocupação total do veículo quando aplicável.

Mostrar:

"Capacidade insuficiente — necessários 6 lugares."

==================================================

12. MANUTENÇÃO E BLOQUEIO DO VEÍCULO

==================================================

No cadastro de cada veículo deve existir a ação:

"COLOCAR EM MANUTENÇÃO"

Ao clicar, abrir formulário:

- data de entrada;

- previsão de retorno;

- estabelecimento/oficina;

- cidade;

- motivo/serviço;

- quilometragem;

- observações.

Exemplo:

Veículo:

QXW3F17

Entrada:

10/08/2026

Previsão de retorno:

15/08/2026

Serviço:

Revisão periódica

Status:

EM MANUTENÇÃO

Após confirmar:

1. alterar o status operacional;

2. bloquear o veículo para novas alocações;

3. mostrar o veículo como "Em manutenção" no painel;

4. verificar se existem viagens futuras conflitantes com o período de manutenção.

Se houver viagens já programadas, emitir ALERTA ao administrador:

"ATENÇÃO: este veículo possui 2 viagens programadas durante o período informado."

Mostrar as viagens afetadas para que o DAFI possa realocá-las.

Não cancelar viagens automaticamente.

==================================================

13. RETORNO DA MANUTENÇÃO

==================================================

Na ficha do veículo em manutenção criar:

"FINALIZAR MANUTENÇÃO"

Solicitar:

- data de retorno;

- quilometragem;

- serviço realizado;

- custo, opcional;

- observações.

Após finalizar:

STATUS:

DISPONÍVEL

desde que não exista outro bloqueio administrativo.

Manter todo histórico de manutenção do veículo.

==================================================

14. FICHA INDIVIDUAL DO VEÍCULO

==================================================

Cada veículo deve possuir uma página própria.

Exemplo:

FIAT STRADA

PUE8477

[foto]

STATUS ATUAL

DISPONÍVEL

Quilometragem:

133.065 km

Capacidade:

5 pessoas

Combustível:

Diesel

Mostrar abas:

VISÃO GERAL

AGENDA

VIAGENS

MANUTENÇÕES

ABASTECIMENTOS

HISTÓRICO

AGENDA:

Mostrar todas as reservas daquele veículo.

Exemplo:

12 AGO

07:00–17:00

Espera Feliz

PROGRAMADA

14 AGO

06:00–22:00

Belo Horizonte

PROGRAMADA

O administrador deve conseguir consultar facilmente quando o veículo estará livre.

==================================================

15. VISUALIZAÇÃO PELO SOLICITANTE

==================================================

Antes da aprovação:

SOLICITAÇÃO #154

12/08/2026

Espera Feliz

Status:

AGUARDANDO APROVAÇÃO

Veículo:

A DEFINIR PELO DAFI

Motorista:

A DEFINIR

Após aprovação:

SOLICITAÇÃO #154

Status:

APROVADA

VEÍCULO DESIGNADO

Fiat Strada

PUE8477

Motorista:

Fabiano

Saída:

07:00

Retorno previsto:

17:00

O usuário não poderá alterar o veículo.

Se o administrador posteriormente trocar o veículo, registrar a alteração e notificar o solicitante.

Exemplo:

"O veículo da sua viagem de 12/08 foi alterado.

Anterior:

PUE8477

Novo:

OQM8523"

==================================================

16. MAPA VISUAL DA FROTA

==================================================

No Dashboard DAFI criar uma seção:

"Situação da Frota"

Mostrar cards dos veículos.

Exemplo:

┌─────────────────────┐

│ Fiat Strada         │

│ PUE8477             │

│                     │

│ ✓ DISPONÍVEL        │

│                     │

│ Próxima viagem:     │

│ Hoje • 14:00        │

└─────────────────────┘

┌─────────────────────┐

│ Fiat Cronos         │

│ QXW3H27             │

│                     │

│ ● EM VIAGEM         │

│                     │

│ Belo Horizonte      │

│ Retorno: 20:00      │

└─────────────────────┘

┌─────────────────────┐

│ Fiat Strada         │

│ QXW3F17             │

│                     │

│ ⚠ EM MANUTENÇÃO    │

│                     │

│ Previsão: 15/08     │

└─────────────────────┘

O status deve ser calculado considerando o momento atual e os registros existentes.

==================================================

17. VISÃO DE AGENDA POR VEÍCULO

==================================================

Além da agenda geral de viagens, criar uma visualização específica:

"Agenda da Frota"

Exibir os veículos em linhas e datas/horários em colunas.

Permitir visualizar rapidamente períodos:

LIVRE

RESERVADO

EM VIAGEM

MANUTENÇÃO

INDISPONÍVEL

O objetivo é permitir que o DAFI responda rapidamente:

"Qual carro está disponível terça-feira entre 08:00 e 17:00?"

==================================================

18. REGRAS DE NEGÓCIO IMPORTANTES

==================================================

1. O usuário solicita uma VIAGEM e não um veículo.

2. O DAFI é responsável por alocar o veículo.

3. Após a aprovação/alocação, o usuário consegue visualizar o veículo e a placa que utilizará.

4. O administrador deve visualizar veículos disponíveis e indisponíveis antes de realizar a alocação.

5. A disponibilidade é determinada por período, e não apenas por um campo de status.

6. Um veículo reservado pela manhã pode estar disponível à tarde.

7. Não permitir sobreposição de reservas.

8. Veículo EM MANUTENÇÃO não pode ser selecionado.

9. Veículo INDISPONÍVEL não pode ser selecionado.

10. Verificar capacidade de passageiros.

11. Alteração posterior do veículo deve gerar histórico e notificação.

12. Colocar veículo em manutenção deve verificar viagens futuras afetadas.

13. Finalizar manutenção deve liberar o veículo novamente quando não houver outro impedimento.

14. Nunca excluir o histórico de utilização do veículo.

15. O administrador deve conseguir consultar toda a agenda futura de cada veículo.

16. Viagens canceladas devem liberar imediatamente a reserva do veículo.

17. Viagens rejeitadas não reservam veículo.

18. Solicitações pendentes não reservam veículo.

19. Somente viagens aprovadas/programadas bloqueiam a disponibilidade do veículo.

20. O sistema deve impedir conflitos tanto no frontend quanto no backend/banco de dados.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://frotasre.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/da9ec3ab-a5b5-4d39-8980-80fcaa172580).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
