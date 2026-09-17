# user-auth Specification

## Purpose

Autenticar usuários do sistema financeiro pessoal via email e senha, mantendo uma sessão de longa duração renovável sem exigir login repetido, enquanto permite revogar essa sessão a qualquer momento (logout ou detecção de reuso indevido de token).

## Requirements

### Requirement: User Registration
O sistema SHALL permitir que um novo usuário se registre com email e senha, criando a conta e retornando imediatamente uma sessão autenticada (access token + refresh token), sem exigir um login separado em seguida.

#### Scenario: Successful registration
- **WHEN** um visitante se registra com um email ainda não cadastrado e uma senha
- **THEN** o sistema cria a conta e retorna um access token e um refresh token válidos

#### Scenario: Registration with duplicate email
- **WHEN** um visitante se registra com um email que já pertence a uma conta existente
- **THEN** o sistema rejeita a requisição com status 409 e nenhuma conta nova é criada

### Requirement: Login
O sistema SHALL autenticar um usuário por email e senha, emitindo um novo par de access e refresh token quando as credenciais forem válidas.

#### Scenario: Successful login
- **WHEN** um usuário envia o email e a senha corretos de uma conta existente
- **THEN** o sistema retorna um novo access token e um novo refresh token

#### Scenario: Login with nonexistent email
- **WHEN** um usuário envia um email que não corresponde a nenhuma conta
- **THEN** o sistema rejeita a requisição com status 401 e uma mensagem genérica de credenciais inválidas

#### Scenario: Login with wrong password
- **WHEN** um usuário envia um email de uma conta existente com a senha incorreta
- **THEN** o sistema rejeita a requisição com status 401 e a mesma mensagem genérica usada para email inexistente, sem indicar qual dos dois fatores falhou

### Requirement: Token Lifetimes
O sistema SHALL emitir access tokens com expiração de 15 minutos e refresh tokens com expiração de 30 dias.

#### Scenario: Access token expires after 15 minutes
- **WHEN** um access token emitido há mais de 15 minutos é usado para acessar uma rota protegida
- **THEN** o sistema rejeita a requisição por token expirado

#### Scenario: Refresh token expires after 30 days
- **WHEN** um refresh token emitido há mais de 30 dias é usado para renovar a sessão
- **THEN** o sistema rejeita a renovação por token expirado, exigindo novo login

### Requirement: Session Refresh with Rotation
O sistema SHALL permitir trocar um refresh token válido e não expirado por um novo par de access e refresh token, invalidando o refresh token anterior no mesmo momento (rotação).

#### Scenario: Valid refresh token rotates the session
- **WHEN** um usuário apresenta o refresh token válido e atual da sua sessão
- **THEN** o sistema retorna um novo access token e um novo refresh token, e o refresh token anterior deixa de ser aceito em requisições futuras

### Requirement: Refresh Token Reuse Detection
O sistema SHALL detectar a reapresentação de um refresh token que já foi rotacionado (substituído por um mais novo) e, ao detectar isso, invalidar a sessão do usuário, exigindo um novo login.

#### Scenario: Reused refresh token invalidates the session
- **WHEN** um refresh token que já foi trocado por um novo em uma rotação anterior é apresentado novamente
- **THEN** o sistema rejeita a requisição, invalida a sessão ativa do usuário e um novo login passa a ser obrigatório para obter um refresh token válido

### Requirement: Logout
O sistema SHALL permitir que um usuário autenticado encerre sua sessão, invalidando seu refresh token atual.

#### Scenario: Logout invalidates the refresh token
- **WHEN** um usuário autenticado com um access token válido solicita logout
- **THEN** o sistema invalida o refresh token atual do usuário, e esse refresh token deixa de ser aceito em requisições futuras de renovação

#### Scenario: Logout requires a valid access token
- **WHEN** uma requisição de logout é feita sem um access token válido
- **THEN** o sistema rejeita a requisição com status 401 e nenhuma sessão é alterada

### Requirement: Single Active Session Per User
O sistema SHALL manter no máximo um refresh token válido por usuário; um novo login ou uma rotação de refresh invalida qualquer refresh token emitido anteriormente para aquele usuário.

#### Scenario: New login invalidates the previous session
- **WHEN** um usuário realiza login enquanto já possui uma sessão ativa (refresh token válido emitido anteriormente)
- **THEN** o sistema emite uma nova sessão e o refresh token da sessão anterior deixa de ser aceito
