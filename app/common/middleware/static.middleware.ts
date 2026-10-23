import { INestApplication } from '@nestjs/common';
import { resolve } from 'path';
import express = require('express');

const staticOptions = {
  fallthrough: true,
  redirect: false,
};

export function applyStaticAssets(app: INestApplication) {
  const httpApp = app.getHttpAdapter().getInstance();

  const frameworkPublic = resolve(__dirname, '../../../app/public');
  const businessPublic = resolve(process.cwd(), 'app/public');

  httpApp.use(express.static(frameworkPublic, staticOptions));
  httpApp.use(express.static(businessPublic, staticOptions));
}
