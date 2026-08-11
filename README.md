# Gestão de Frota — SRE

Sistema web para gestão e organização da frota de veículos da Superintendência Regional de Ensino (SRE).

A aplicação tem como objetivo centralizar as solicitações de veículos, aprovação, organização da agenda, gestão da frota, motoristas, destinos, passageiros e caronas, proporcionando ao DAFI e aos servidores uma visão integrada da utilização dos veículos institucionais.

---

## Objetivo

O sistema foi desenvolvido para substituir processos descentralizados de controle de veículos, especialmente planilhas e solicitações manuais, proporcionando:

- Solicitação antecipada de veículos;
- Controle e aprovação das solicitações;
- Gestão de veículos;
- Controle de disponibilidade;
- Controle de manutenção;
- Gestão de usuários e motoristas;
- Cadastro de cidades e destinos;
- Organização das viagens;
- Agenda de viagens;
- Solicitação de caronas;
- Organização operacional dos veículos e motoristas;
- Notificações aos usuários;
- Histórico e auditoria das operações.

---

## Contexto

A frota da SRE é utilizada para atender deslocamentos institucionais de servidores, equipes e grupos de trabalho.

As solicitações precisam ser realizadas antecipadamente, contendo informações como:

- data;
- horário previsto;
- cidade de destino;
- local de destino;
- motivo da viagem;
- passageiros;
- necessidade de motorista;
- informações complementares.

O DAFI é responsável pelo acompanhamento e organização da utilização dos veículos.

O sistema permite que as solicitações sejam analisadas e, posteriormente, organizadas operacionalmente em função da disponibilidade de veículos e motoristas.

---

# Principais módulos

## Dashboard

Visão geral da operação da frota, com informações sobre:

- solicitações;
- viagens;
- veículos;
- disponibilidade;
- manutenção;
- motoristas;
- caronas;
- pendências administrativas.

---

## Solicitação de Viagem

Os servidores podem realizar solicitações antecipadas informando:

- data;
- horário previsto;
- cidade;
- destino;
- motivo;
- passageiros;
- necessidade de motorista.

O horário informado pelo solicitante representa uma **previsibilidade operacional** e pode ser ajustado posteriormente durante a organização da viagem.

---

## Minhas Solicitações

Área destinada ao acompanhamento das solicitações realizadas pelo usuário.

Permite visualizar:

- solicitações pendentes;
- aprovadas;
- rejeitadas;
- canceladas;
- informações da viagem;
- veículo definido;
- motorista;
- alterações realizadas.

---

## Minhas Viagens

Mostra as viagens das quais o usuário efetivamente participa.

Uma viagem pode ser originada por:

- solicitação própria;
- participação como passageiro;
- carona aprovada.

---

## Viagens Programadas

Agenda geral das viagens aprovadas.

A visualização foi projetada para facilitar:

- consulta de viagens;
- identificação de dias disponíveis;
- localização por cidade;
- consulta por setor;
- identificação de veículos;
- consulta de motoristas;
- solicitação de carona.

A agenda utiliza visualização em calendário para facilitar o planejamento.

---

# Gestão da Frota

## Veículos

Cadastro e gerenciamento dos veículos institucionais.

Informações previstas:

- placa;
- fabricante;
- modelo;
- ano;
- tipo;
- combustível;
- capacidade;
- patrimônio;
- quilometragem;
- observações;
- status operacional.

### Status

Um veículo pode estar:

- Disponível;
- Reservado;
- Em viagem;
- Em manutenção;
- Indisponível.

Veículos em manutenção ou indisponíveis não podem ser utilizados em novas viagens.

---

## Manutenção

A manutenção está integrada ao cadastro do veículo.

Cada veículo possui histórico de manutenção, permitindo registrar informações como:

- entrada;
- previsão de retorno;
- retorno efetivo;
- oficina;
- serviço realizado;
- quilometragem;
- custo;
- observações.

O histórico de manutenção permanece associado ao veículo.

---

# Usuários e permissões

O sistema possui diferentes níveis de acesso.

## Usuário

Pode:

- solicitar viagens;
- acompanhar solicitações;
- consultar viagens programadas;
- solicitar caronas;
- acompanhar notificações.

## Administrador

Possui recursos adicionais para:

- analisar solicitações;
- organizar viagens;
- gerenciar veículos;
- gerenciar destinos;
- gerenciar usuários;
- administrar a operação da frota.

## Super Admin

Possui nível administrativo superior, destinado ao gerenciamento das permissões administrativas do sistema.

A estrutura de permissões está sendo aprimorada continuamente.

---

# Motoristas

Os motoristas da SRE são identificados a partir dos usuários cadastrados no sistema.

Um usuário pode possuir a função:

**Motorista da SRE**

Quando habilitado, ele pode ser selecionado como motorista em viagens e programações.

Informações adicionais podem ser associadas ao usuário, incluindo:

- CPF;
- telefone;
- endereço;
- CNH;
- categorias;
- validade da CNH;
- observações.

A função de motorista é independente do nível administrativo do usuário.

Assim, um usuário pode ser simultaneamente:

- Usuário + Motorista;
- Administrador + Motorista;
- Super Admin + Motorista.

---

# Destinos

Os destinos são organizados hierarquicamente:

```text
Cidade
   └── Destinos
