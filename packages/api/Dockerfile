FROM oven/bun

WORKDIR /app

COPY bun.lockb package.json ./

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3001

CMD ["bun", "run", "start"]
